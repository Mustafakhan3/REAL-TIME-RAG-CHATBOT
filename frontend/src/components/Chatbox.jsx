// src/components/Chatbox.jsx
import axios from "axios";
import React, { useState, useRef, useEffect } from "react";
import Message from "./Message";
import { Menu, X, Trash2, ArrowDown } from "lucide-react";
import { auth, db } from "../firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

// 👇 NEW: pick API base from env (Netlify) or fall back to localhost (your local dev)
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

function Chatbox() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const chatEndRef = useRef(null);
  const scrollRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const autoScrollRef = useRef(true);
  const bootstrappedRef = useRef(false);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    autoScrollRef.current = autoScroll;
  }, [autoScroll]);

  function titleFrom(text) {
    const clean = text.replace(/\s+/g, " ").trim();
    return clean.split(" ").slice(0, 8).join(" ");
  }

  function atBottom(el, eps = 2) {
    if (!el) return true;
    return Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) <= eps;
  }

  const smartScrollToBottom = (behavior = "auto") => {
    if (autoScrollRef.current) chatEndRef.current?.scrollIntoView({ behavior });
  };

  // ---- Memory helpers (frontend) ----
  const MAX_TURNS = 12;
  const MAX_CHARS = 6000;

  function toChatMessages(msgs) {
    return msgs.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content ?? "",
    }));
  }

  function buildHistory(prevMessages, newUserText) {
    const base = toChatMessages(prevMessages);
    base.push({ role: "user", content: newUserText });
    let trimmed = base.slice(-MAX_TURNS * 2);
    const totalChars = (arr) =>
      arr.reduce((n, m) => n + (m.content?.length || 0), 0);
    while (trimmed.length > 1 && totalChars(trimmed) > MAX_CHARS) {
      trimmed = trimmed.slice(1);
    }
    return trimmed;
  }

  // ---- Load chats (left sidebar) ----
  useEffect(() => {
    if (!uid) return;
    const colRef = collection(db, "users", uid, "chats");
    const q = query(colRef, orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(q, async (snap) => {
      const rows = [];
      snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
      setChats(rows);

      if (!bootstrappedRef.current) {
        bootstrappedRef.current = true;
        if (rows.length === 0) {
          const defaultRef = doc(db, "users", uid, "chats", "default");
          await setDoc(
            defaultRef,
            {
              title: "New Chat",
              lastMessage: "",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              archived: false,
            },
            { merge: false }
          );
          setActiveChatId("default");
        } else {
          setActiveChatId((prev) => prev ?? rows[0].id);
        }
      } else {
        if (!activeChatId && rows.length > 0) setActiveChatId(rows[0].id);
      }
    });
    return () => unsub();
  }, [uid, activeChatId]);

  // ---- Load messages in active chat ----
  useEffect(() => {
    if (!uid || !activeChatId) return;
    const colRef = collection(db, "users", uid, "chats", activeChatId, "messages");
    const q = query(colRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const rows = [];
      snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
      setMessages(rows);
      setTimeout(() => smartScrollToBottom("smooth"), 50);
    });
    return () => unsub();
  }, [uid, activeChatId]);

  // ---- Scroll lock ----
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onGestureStart = () => {
      if (!atBottom(el)) {
        setAutoScroll(false);
        autoScrollRef.current = false;
      }
    };
    const onScroll = () => {
      const follow = atBottom(el);
      setAutoScroll(follow);
      autoScrollRef.current = follow;
    };
    el.addEventListener("mousedown", onGestureStart);
    el.addEventListener("touchstart", onGestureStart, { passive: true });
    el.addEventListener("wheel", onScroll, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("touchmove", onScroll, { passive: true });
    onScroll();
    return () => {
      el.removeEventListener("mousedown", onGestureStart);
      el.removeEventListener("touchstart", onGestureStart);
      el.removeEventListener("wheel", onScroll);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("touchmove", onScroll);
    };
  }, []);

  // ---- Delete chat ----
  const handleDeleteChat = async (id) => {
    if (!uid || !id) return;
    if (!confirm("Delete this chat permanently?")) return;
    setDeletingId(id);
    try {
      const msgsCol = collection(db, "users", uid, "chats", id, "messages");
      const msgs = await getDocs(query(msgsCol, limit(500)));
      await Promise.all(msgs.docs.map((d) => deleteDoc(d.ref)));
      await deleteDoc(doc(db, "users", uid, "chats", id));
      if (activeChatId === id) {
        setActiveChatId(null);
        setMessages([]);
      }
    } finally {
      setDeletingId(null);
    }
  };
const handleSend = async () => {
  if (!input.trim() || !uid || !activeChatId) return;
  const text = input.trim();
  setInput("");
  setLoading(true);

  const el = scrollRef.current;
  const follow = atBottom(el);
  setAutoScroll(follow);
  autoScrollRef.current = follow;

  await addDoc(collection(db, "users", uid, "chats", activeChatId, "messages"), {
    role: "user",
    content: text,
    createdAt: serverTimestamp(),
  });

  const isFirst = messages.length === 0;
  await updateDoc(doc(db, "users", uid, "chats", activeChatId), {
    ...(isFirst ? { title: titleFrom(text) } : {}),
    lastMessage: "",
    updatedAt: serverTimestamp(),
  });

  try {
    const history = buildHistory(messages, text);

    const res = await axios.post(`${API_BASE}/api/chat`, {
      message: text,
      userId: uid,
      history,
    });

    const fullReply = res.data.reply || "No response received.";
    const respSources = Array.isArray(res.data.sources) ? res.data.sources : [];

    // streaming typing effect
    setIsStreaming(true);
    setStreamText("");
    const chunkSize = 4;
    const tickMs = 18;
    let i = 0;
    await new Promise((resolve) => {
      const timer = setInterval(() => {
        i += chunkSize;
        const next = fullReply.slice(0, i);
        setStreamText(next);
        if (autoScrollRef.current) smartScrollToBottom("auto");
        if (i >= fullReply.length) {
          clearInterval(timer);
          resolve();
        }
      }, tickMs);
    });

    // ✅ stop streaming FIRST so only the Firestore message renders
    setIsStreaming(false);
    setStreamText("");

    // now persist assistant message (snapshot will render it once)
    await addDoc(collection(db, "users", uid, "chats", activeChatId, "messages"), {
      role: "assistant",
      content: fullReply,
      sources: respSources,
      createdAt: serverTimestamp(),
    });

    await updateDoc(doc(db, "users", uid, "chats", activeChatId), {
      lastMessage: "",
      updatedAt: serverTimestamp(),
    });

    setLoading(false);
    smartScrollToBottom("smooth");
  } catch (err) {
    console.error("❌ Backend error:", err?.message || err);
    setIsStreaming(false);
    setStreamText("");
    setLoading(false);
  }
};

  // ---- Send with memory ----
 
  return (
    <div className="flex h-screen min-h-0 bg-zinc-950 text-white overflow-hidden relative">
      {/* Sidebar */}
      <div
        className={`fixed sm:static inset-y-0 left-0 z-40 w-40 sm:w-44 md:w-48 lg:w-52 bg-zinc-900 border-r border-zinc-800 p-4 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"}
      `}
      >
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-base font-semibold">Saved Chats</h2>
          <button
            className="sm:hidden text-zinc-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={22} />
          </button>
        </div>
        <div className="space-y-2 overflow-y-auto max-h-[80vh] pr-1">
          {chats.length === 0 ? (
            <p className="text-zinc-500 text-sm">No chats yet</p>
          ) : (
            chats.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center justify-between gap-2 text-sm px-2 py-2 rounded-lg cursor-pointer border border-transparent hover:border-zinc-700
                ${activeChatId === c.id ? "bg-zinc-800 border-zinc-700" : "bg-zinc-900"}
              `}
              >
                <button
                  className="flex-1 text-left truncate"
                  title={c.title || "Untitled"}
                  onClick={() => setActiveChatId(c.id)}
                >
                  <div className="truncate">{c.title || "Untitled"}</div>
                </button>
                <button
                  className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-400 transition"
                  onClick={() => handleDeleteChat(c.id)}
                  disabled={deletingId === c.id}
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-col flex-1 min-h-0 items-center justify-between p-3 sm:p-4 md:p-3 w-full">
        <div className="w-full flex items-center justify-between sm:hidden mb-3">
          <button
            className="text-zinc-300 hover:text-white"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          <h1 className="text-lg font-semibold">Chatbot</h1>
          <div className="w-6" />
        </div>

        {/* Scroll area */}
        <div
  ref={scrollRef}
  className="chat-scroll w-full max-w-4xl flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-3 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl relative"
>

        
          {messages.length === 0 ? (
            <div className="text-center text-zinc-500 mt-10 text-sm sm:text-base">
              Start a conversation...
            </div>
          ) : (
           messages.map((m, i) => (
  <Message
    key={m.id || i}
    text={m.content}
    sender={m.role === "user" ? "user" : "bot"}
    sources={m.sources || []}
  />
))
          )}
          {isStreaming && <Message text={streamText} sender="bot" sources={[]} />}

          {loading && !isStreaming && (
            <div className="flex justify-start px-4">
              <div className="flex gap-1 mt-2">
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-.3s]"></span>
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-.15s]"></span>
              </div>
            </div>
          )}
          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true);
                autoScrollRef.current = true;
                smartScrollToBottom("smooth");
              }}
              className="absolute right-4 bottom-4 flex items-center gap-1 bg-zinc-800/90 hover:bg-zinc-700 text-white text-xs px-3 py-2 rounded-full shadow-lg border border-zinc-700"
              title="Jump to latest"
            >
              <ArrowDown size={14} />
              New messages
            </button>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="w-full max-w-3xl mt-4 border-t border-zinc-800 bg-zinc-950 p-3 rounded-xl">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Message ChatGPT..."
              className="flex-1 bg-zinc-800 text-zinc-50 placeholder-zinc-500 px-3 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <button
              onClick={handleSend}
              disabled={loading || !activeChatId}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-2.5 rounded-xl font-medium transition text-sm"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chatbox;
