// routes/chatRoute.js
import express from 'express';
import { fetchWebResults, fetchNewsResults } from '../services/serperService.js';
import { chatWithGroq } from '../services/openaiService.js';
import { db } from '../lib/firebase.js';
import admin from 'firebase-admin';

const router = express.Router();

/** ---- Memory limits ---- */
const MAX_TURNS = 12;
const MAX_CHARS = 6000;

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

  // keep last N turns (≈ 2 msgs/turn)
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
  const m = message.toLowerCase();
  const hints = [
    'do you remember',
    'remember my last message',
    'what was my last message',
    'what did i say before',
  ];
  if (!hints.some((h) => m.includes(h))) return null;

  // previous user message before the current one
  const users = safeHistory.filter((x) => x.role === 'user');
  const prevUser = users.length >= 2 ? users[users.length - 2].content : null;
  if (!prevUser) return "You haven't sent any message before this one in this chat.";
  return `Yes — your previous message in this chat was:\n\n“${prevUser}”`;
}

/** Decide if fresh info is needed */
function needsFreshInfo(message) {
  const re = /(latest|today|now|news|update|price|rate|this week|this month|current|who is|new|recent)/i;
  return re.test(message || '');
}

router.post('/chat', async (req, res) => {
  try {
    const { message, userId, history } = req.body;

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
      console.log('memoryAnswer:', memoryAnswer);
      await db.collection('messages').add({
        userId,
        role: 'user',
        content: message,
        reply: memoryAnswer,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return res.json({ reply: memoryAnswer, sources: [] });
    }

    // 3) Optional web/news — ONLY if needed
    let webResults = null;
    let newsResults = null;
    if (needsFreshInfo(message)) {
      [webResults, newsResults] = await Promise.all([
        fetchWebResults(message),
        fetchNewsResults(message),
      ]);
    }

    const combined = [
      ...(webResults?.organic || []),
      ...(newsResults?.news || []),
    ];

    // keep short & clean snippets
    const MAX_SNIP = 300;
    const contextBullets = combined.slice(0, 6).map((r, i) => {
      const title = (r.title || r.link || 'Untitled').trim();
      const snip = (r.snippet || '').replace(/\s+/g, ' ').slice(0, MAX_SNIP);
      const link = r.link || 'N/A';
      return `(${i + 1}) ${title}\n${snip}\nLink: ${link}`;
    });

    // 4) messages[] = strict system + optional snippets + prior turns + current user
    const systemMsg = {
      role: 'system',
      content: [
        "You are a precise assistant. Answer concisely and factually.",
        "If web/news snippets are provided, prefer them over prior knowledge.",
        "If information is uncertain, missing, conflicting, or outdated, say so explicitly.",
        "Never invent citations or facts. Do not guess numbers or dates.",
        "If the user asks for the latest or real-time info, use the provided snippets.",
        "If snippets are irrelevant, ignore them and answer from stable knowledge, or say you don't have enough info."
      ].join(' ')
    };

    const snippetsMsg = {
      role: 'system',
      content: contextBullets.length
        ? ["Web/news snippets (optional):", "", ...contextBullets.map((b) => "- " + b)].join('\n')
        : "No web/news snippets for this question."
    };

    const turns = [...safeHistory];
    const userMsg = {
      role: 'user',
      content: needsFreshInfo(message)
        ? `${message}\n\nIf the snippets don't confirm the answer, say you can't verify it.`
        : message
    };

    const messages = [systemMsg, snippetsMsg, ...turns, userMsg];

    console.log('messages count:', messages.length);
    console.log('messages last two:', messages.slice(-2));

    // 5) call Groq
    const reply = await chatWithGroq(messages, {
      temperature: 0.1,
      maxTokens: 900,
      model: 'llama-3.3-70b-versatile',
    });

    console.log('Groq reply (start):', (reply || '').slice(0, 140));

    // 6) sources for UI
    const sources = combined.slice(0, 4).map((r) => ({
      title: r.title || r.link,
      link: r.link,
    }));

    // 7) log (optional)
    await db.collection('messages').add({
      userId,
      role: 'user',
      content: message,
      reply,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ reply, sources });
  } catch (e) {
    console.error('Chat error:', e?.response?.data || e);
    return res.status(500).json({ reply: 'Server error.', sources: [] });
  }
});

export default router;
