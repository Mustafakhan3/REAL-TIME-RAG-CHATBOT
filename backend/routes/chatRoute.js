// routes/chatRoute.js
import express from 'express';
import { fetchWebResults, fetchNewsResults } from '../services/serperService.js';
import { chatWithGroq } from '../services/openaiService.js';
import { db } from '../lib/firebase.js';
import admin from 'firebase-admin';

const router = express.Router();

/** ---- Memory & limits ---- */
const MAX_TURNS = 12;
const MAX_CHARS = 6000;

/** Tiny timeout wrapper so external calls can’t hang forever */
const withTimeout = (p, ms, label = 'op') =>
  Promise.race([
    p,
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error(`${label} timeout after ${ms}ms`)), ms)
    ),
  ]);

/** Clean incoming history */
function sanitizeHistory(historyRaw) {
  if (!Array.isArray(historyRaw)) return [];
  const cleaned = historyRaw
    .filter(
      (m) =>
        m &&
        typeof m === 'object' &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string'
    )
    .map((m) => ({ role: m.role, content: m.content.trim() }))
    .filter((m) => m.content.length > 0);

  // keep last N turns (≈2 msgs/turn)
  let trimmed = cleaned.slice(-MAX_TURNS * 2);

  // enforce char budget
  const totalChars = (arr) => arr.reduce((n, m) => n + m.content.length, 0);
  while (trimmed.length > 1 && totalChars(trimmed) > MAX_CHARS) {
    trimmed = trimmed.slice(1);
  }
  return trimmed;
}

/** Intercept “do you remember…” questions deterministically */
function maybeHandleMemoryQuery(message, safeHistory) {
  const m = (message || '').toLowerCase();
  const hints = [
    'do you remember',
    'remember my last message',
    'what was my last message',
    'what did i say before',
  ];
  if (!hints.some((h) => m.includes(h))) return null;

  const users = safeHistory.filter((x) => x.role === 'user');
  const prevUser = users.length >= 2 ? users[users.length - 2].content : null;
  if (!prevUser) return "You haven't sent any message before this one in this chat.";
  return `Yes — your previous message in this chat was:\n\n“${prevUser}”`;
}

/** ---- Freshness + query classification (GENERAL) ---- */
function classifyQuery(message = '') {
  const m = message.toLowerCase().trim();

 const freshSignals = [
  'latest','today','now','news','update','price','rate','current','recent',
  'this week','this month','as of','right now','breaking',
  'when','time','date','schedule','start','starts','release','launched',
  'who is','who\'s','election','meeting','event',
  'weather','forecast','live'
];


  const timelessSignals = [
    'how to','explain','what is','what are','why','guide','tutorial','example',
    'difference between','meaning of'
  ];

  const hasFresh = freshSignals.some(s => m.includes(s));
  const hasTimeless = timelessSignals.some(s => m.includes(s));

  const looksLikeSimpleQuestion =
    m.endsWith('?') ||
    m.startsWith('tell me') ||
    m.startsWith('can you') ||
    m.startsWith('please') ||
    m.split(' ').length <= 6;

  if (hasFresh && !hasTimeless) return 'fresh_required';
  if (!hasFresh && hasTimeless) return 'timeless';
  if (hasFresh && hasTimeless) return 'mixed';
  if (looksLikeSimpleQuestion) return 'mixed';

  return 'default';
}

/** ---- Dedupe by link/title ---- */
function dedupeResults(results = []) {
  const seen = new Set();
  const out = [];
  for (const r of results) {
    const key = (r.link || r.title || '').toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/** ---- Simple trust + recency scoring ---- */
function scoreResult(r) {
  const link = (r.link || '').toLowerCase();
  const title = (r.title || '').toLowerCase();
  const snippet = (r.snippet || '').toLowerCase();

  const trustedDomains = [
    'reuters.com','bloomberg.com','coindesk.com','cointelegraph.com',
    'bbc.com','theverge.com','wsj.com','nytimes.com','official','gov','edu'
  ];
  const trust = trustedDomains.some(d => link.includes(d)) ? 2 : 0;

  const dateStr = r.date || r.iso_date || r.publishedDate;
  let recency = 0;
  if (dateStr) {
    const t = Date.parse(dateStr);
    if (!Number.isNaN(t)) {
      const ageDays = (Date.now() - t) / (1000 * 60 * 60 * 24);
      if (ageDays <= 3) recency = 3;
      else if (ageDays <= 14) recency = 2;
      else if (ageDays <= 60) recency = 1;
    }
  }

  const kwBoost =
    (title.includes('official') || snippet.includes('official')) ? 1 : 0;

  return trust + recency + kwBoost;
}

function rankResults(results) {
  return [...results].sort((a, b) => scoreResult(b) - scoreResult(a));
}

/** ---- Deep-search helpers ---- */

/** Expand query when results are weak */
function expandQuery(q = '') {
  const base = q.trim();
  return [
    base,
    `${base} latest update`,
    `${base} official announcement`,
  ];
}

/** quick weak-result check */
function resultsWeak(results = []) {
  if (!results.length) return true;
  const hasSnippets = results.some(r => (r.snippet || '').length > 40);
  return !hasSnippets;
}

/** normalize short/soft queries for better Serper hits */
function normalizeQuery(q = '') {
  const m = q.toLowerCase();

  // If user asks time/date based stuff, add "official time" keywords.
  if (m.includes('when') || m.includes('time') || m.includes('date') || m.includes('schedule')) {
    return `${q} official time`;
  }

  // If user asks price/rate, add live/current keywords.
  if (m.includes('price') || m.includes('rate') || m.includes('exchange')) {
    return `${q} live current`;
  }

  // If user asks about a person/role, add current/official keywords.
  if (m.includes('who is') || m.includes("who's") || m.includes('ceo') || m.includes('president')) {
    return `${q} current official`;
  }

  return q;
}


router.post('/chat', async (req, res) => {
  try {
    // Accept BOTH shapes:
    // A) { message, userId, history }
    // B) { messages: [{role, content}, ...], userId }
    let { message, userId, history } = req.body || {};

    if (!message && Array.isArray(req.body?.messages)) {
      const lastUser = [...req.body.messages].reverse().find(m => m?.role === 'user');
      message = lastUser?.content;
      history = req.body.messages;
    }

    // ---- DIAGNOSTICS ----
    console.log('\n=== /api/chat ===');
    console.log('userId:', userId);
    console.log('message:', message);
    console.log(
      'history raw type:',
      Array.isArray(history) ? `array(${history.length})` : typeof history
    );

    if (!message || !userId) {
      return res.status(400).json({ error: 'Message and userId are required' });
    }

    // 1) sanitize/trim history
    const safeHistory = sanitizeHistory(history || []);
    console.log('history sanitized len:', safeHistory.length);
    console.log('history tail:', safeHistory.slice(-3));

    // 2) direct memory answer (no model)
    const memoryAnswer = maybeHandleMemoryQuery(message, safeHistory);
    if (memoryAnswer) {
      try {
        await db.collection('messages').add({
          userId,
          role: 'user',
          content: message,
          reply: memoryAnswer,
          createdAt: admin.firestore.FieldValue?.serverTimestamp?.() ?? new Date(),
        });
      } catch {}
      return res.json({ reply: memoryAnswer, sources: [] });
    }

    // 3) web/news retrieval if needed (DEEP SEARCH)
    let combined = [];
    const SERPER_OK = !!process.env.SERPER_API_KEY;
    const qType = classifyQuery(message);

    if ((qType === 'fresh_required' || qType === 'mixed') && SERPER_OK) {
      try {
        const searchQ = normalizeQuery(message);

        // round 1
        const [web1, news1] = await withTimeout(
          Promise.all([
            fetchWebResults(searchQ),
            fetchNewsResults(searchQ),
          ]),
          8000,
          'serper-round1'
        );

        combined = dedupeResults([
          ...(news1?.news || []),
          ...(web1?.organic || []),
        ]);

        // round 2 if weak
        if (resultsWeak(combined)) {
          const expanded = expandQuery(searchQ);

          const round2Results = [];
          for (const q of expanded.slice(1)) {
            const [web2, news2] = await withTimeout(
              Promise.all([
                fetchWebResults(q),
                fetchNewsResults(q),
              ]),
              8000,
              'serper-round2'
            );

            round2Results.push(
              ...(news2?.news || []),
              ...(web2?.organic || [])
            );
          }

          combined = dedupeResults([...combined, ...round2Results]);
        }

        combined = rankResults(combined).slice(0, 10);
      } catch (e) {
        console.warn('serper skipped:', e?.message || e);
      }
    }

    const MAX_SNIP = 300;
    const contextBullets = combined.slice(0, 10).map((r, i) => {
      const title = (r.title || r.link || 'Untitled').trim();
      const snip = (r.snippet || '').replace(/\s+/g, ' ').slice(0, MAX_SNIP);
      const link = r.link || 'N/A';
      return `(${i + 1}) ${title}\n${snip}\nLink: ${link}`;
    });

    // 4) messages[] = flexible system + optional snippets + history + current user
    const systemMsg = {
  role: "system",
  content: `
You are a helpful, up-to-date assistant.

Rules:
1) Use web/news snippets when they provide useful or recent information.
2) If snippets are incomplete or missing details, use your general knowledge to fill gaps.
3) Never refuse, never say you can't verify, and never say you don't know. Always answer with best effort.
4) If multiple snippets conflict, silently choose the most recent and most official source.
   Official sources include: pcb.com.pk, espncricinfo.com, cricbuzz.com, major newspapers, gov/edu sites.
   "4b) For weather/price/schedule questions: do NOT average or guess. Use the single best ranked snippet's numbers exactly.",
   4c) If top sources disagree slightly on numerical values (like weather highs/lows, exchange rates, or expected timings), give a small range instead of inventing a single number. Example: "expected high around 15–16°C".

5) Do NOT mention snippets, do NOT mention disagreements between sources, and do NOT explain your internal reasoning.
6) Match your answer length to the question:
   - If the question is simple, answer briefly.
   - If the question is big or multi-part, answer in detailed ChatGPT style.
7) If you are uncertain, still answer but softly label it as an estimate — never refuse.
`
};


    const snippetsMsg = {
      role: 'system',
      content: contextBullets.length
        ? ["Web/news snippets:", ...contextBullets.map((b) => "- " + b)].join("\n")
        : "No web/news snippets for this question."
    };

    const turns = [...safeHistory];
    const userMsg = { role: 'user', content: message };

    const messages = [systemMsg, snippetsMsg, ...turns, userMsg];
    console.log('messages count:', messages.length);
    console.log('messages last two:', messages.slice(-2));

    // 5) call Groq with timeout; skip gracefully if key missing
    let reply = "I'm up, but my model key isn't configured on the server.";
    if (process.env.GROQ_API_KEY) {
      try {
        reply = await withTimeout(
          chatWithGroq(messages, {
            temperature: 0.1,
            max_completion_tokens: 900,
            model: 'llama-3.3-70b-versatile',
          }),
          15000,
          'groq'
        );
      } catch (e) {
        console.error('Groq error:', e?.response?.data || e?.message || e);
        reply = 'Sorry — the model call failed.';
      }
    }

    const sources = combined.slice(0, 4).map((r) => ({
      title: r.title || r.link,
      link: r.link,
    }));

    // 6) log (best-effort)
    try {
      await db.collection('messages').add({
        userId,
        role: 'user',
        content: message,
        reply,
        createdAt: admin.firestore.FieldValue?.serverTimestamp?.() ?? new Date(),
      });
    } catch {}

    return res.json({ reply, sources });
  } catch (e) {
    console.error('Chat error:', e?.response?.data || e);
    return res.status(500).json({ reply: 'Server error.', sources: [] });
  }
});

export default router;
