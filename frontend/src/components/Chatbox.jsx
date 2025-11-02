// src/components/Chatbox.jsx
import axios from "axios";
import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import Message from "./Message";
import { Menu, X, Trash2, ArrowDown, Plus } from "lucide-react";
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
  updateDoc,
} from "firebase/firestore";

// 👇 pick API base from env (Netlify) or fall back to localhost (local dev)
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

  const scrollRef = useRef(null);
  const chatEndRef = useRef(null);      // explicit anchor at the end
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

  // Less twitchy bottom check
  function atBottom(el, eps = 12) {
    if (!el) return true;
    const { scrollTop, scrollHeight, clientHeight } = el;
    return scrollTop + clientHeight >= scrollHeight - eps;
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

  // ---- Create a new chat (reusable) ----
  const createNewChat = async () => {
    if (!uid) return null;
    const colRef = collection(db, "users", uid, "chats");
    const chatDoc = await addDoc(colRef, {
      title: "New Chat",
      lastMessage: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      archived: false,
    });
    setActiveChatId(chatDoc.id);
    setMessages([]);
    return chatDoc.id;
  };

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
          await createNewChat();
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

      // Scroll immediately on next frame (no smooth) to avoid visible bump
      requestAnimationFrame(() => smartScrollToBottom("auto"));
    });
    return () => unsub();
  }, [uid, activeChatId]);

  // ---- Scroll lock (keep pinned while streaming; allow unpin when not streaming) ----
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onGestureStart = () => {
      if (!isStreaming && !atBottom(el)) {
        setAutoScroll(false);
        autoScrollRef.current = false;
      }
    };

    const onScroll = () => {
      if (isStreaming) {
        // while streaming, force-follow bottom
        setAutoScroll(true);
        autoScrollRef.current = true;
        return;
      }
      const follow = atBottom(el);
      setAutoScroll(follow);
      autoScrollRef.current = follow;
    };

    el.addEventListener("mousedown", onGestureStart);
    el.addEventListener("touchstart", onGestureStart, { passive: true });
    el.addEventListener("wheel", onScroll, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("touchmove", onScroll, { passive: true });

    onScroll(); // init

    return () => {
      el.removeEventListener("mousedown", onGestureStart);
      el.removeEventListener("touchstart", onGestureStart);
      el.removeEventListener("wheel", onScroll);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("touchmove", onScroll);
    };
  }, [isStreaming]);

  // Scroll BEFORE paint whenever messages grow or stream updates
  useLayoutEffect(() => {
    if (autoScrollRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [messages, isStreaming]);

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
      if (activeChatId === id) await createNewChat();
    } finally {
      setDeletingId(null);
    }
  };

  // ---- New Chat (sidebar button) ----
  const handleNewChat = async () => {
    await createNewChat();
    setSidebarOpen(false);
  };

  const handleSend = async () => {
    if (!input.trim() || !uid) return;

    let chatId = activeChatId;
    if (!chatId) {
      chatId = await createNewChat();
      if (!chatId) return;
    }

    const text = input.trim();
    setInput("");
    setLoading(true);

    const el = scrollRef.current;
    const follow = atBottom(el);
    setAutoScroll(follow);
    autoScrollRef.current = follow;

    await addDoc(collection(db, "users", uid, "chats", chatId, "messages"), {
      role: "user",
      content: text,
      createdAt: serverTimestamp(),
    });

    const isFirst = messages.length === 0;
    await updateDoc(doc(db, "users", uid, "chats", chatId), {
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

      // stop streaming BEFORE writing the stored assistant message
      setIsStreaming(false);
      setStreamText("");

      // allow React to commit the state change before Firestore snapshot arrives
      await new Promise((r) => requestAnimationFrame(r));

      // persist assistant message (snapshot will render exactly once)
      await addDoc(collection(db, "users", uid, "chats", chatId, "messages"), {
        role: "assistant",
        content: fullReply,
        sources: respSources,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "users", uid, "chats", chatId), {
        lastMessage: "",
        updatedAt: serverTimestamp(),
      });

      setLoading(false);
      smartScrollToBottom("auto");
    } catch (err) {
      console.error("❌ Backend error:", err?.message || err);
      setIsStreaming(false);
      setStreamText("");
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen min-h-0 bg-zinc-950 text-white w-full max-w-[100vw] overflow-hidden overflow-x-hidden relative">
      {/* Sidebar */}
      <div
        className={`fixed sm:static inset-y-0 left-0 z-40 w-56 sm:w-60 md:w-64 lg:w-72 bg-zinc-900 border-r border-zinc-800 p-5 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"}`}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-zinc-100 tracking-tight">Saved Chats</h2>
          <button
            className="sm:hidden text-zinc-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            title="Close sidebar"
          >
            <X size={22} />
          </button>
        </div>

        {/* New Chat button */}
        <button
          onClick={handleNewChat}
          className="w-full mb-5 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 
             text-white font-medium text-base px-4 py-3 rounded-xl shadow-md hover:shadow-lg 
             transition-all duration-200"
          title="Start a new chat"
          aria-label="New chat"
        >
          <Plus size={20} />
          <span>New Chat</span>
        </button>

        <div className="space-y-2.5 overflow-y-auto max-h-[74vh] pr-1.5">
  
{chats.length === 0 ? (
  <p className="text-zinc-500 text-base">No chats yet</p>
) : (
  chats.map((c) => {
    const t = (c.title || "Untitled").trim();
    const isShort = t.length <= 14;

    return (
      <div
        key={c.id}
        className={`group flex items-center gap-2 text-base px-3 py-2.5 rounded-xl cursor-pointer border border-transparent hover:border-zinc-700
        ${activeChatId === c.id ? "bg-zinc-800 border-zinc-700" : "bg-zinc-900"}`}
      >
        {/* IMPORTANT: min-w-0 allows truncation without pushing the icon out */}
        <button
          className={`min-w-0 flex-1 h-9 flex items-center ${
            isShort ? "justify-center text-center" : "justify-start text-left"
          }`}
          title={t}
          onClick={() => setActiveChatId(c.id)}
        >
          <span className="block w-full truncate">{t}</span>
        </button>

        {/* Always visible on mobile; hover-reveal on sm+ */}
        <button
          className="flex-shrink-0 ml-1 p-2 rounded-lg text-zinc-400 hover:text-red-400 transition
                     opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
          onClick={() => handleDeleteChat(c.id)}
          disabled={deletingId === c.id}
          title="Delete"
          aria-label="Delete chat"
        >
          <Trash2 size={18} />
        </button>
      </div>
    );
  })
)}

      </div>
      </div>
  

      

      {/* Chat area */}
      <div className="flex flex-col flex-1 min-h-0 items-center justify-between p-4 sm:p-5 md:p-4 w-full">
        <div className="w-full flex items-center justify-between sm:hidden mb-3">
          <button
            className="text-zinc-300 hover:text-white"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            title="Open sidebar"
          >
            <Menu size={26} />
          </button>
          <h1 className="text-xl font-semibold">Chatbot</h1>
          <div className="w-6" />
        </div>

        {/* Scroll area (make it relative so the button can be absolutely positioned without affecting layout) */}
    <div
  ref={scrollRef}
  className="chat-scroll relative w-full max-w-5xl flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 sm:px-4 py-2 pb-2 space-y-3 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl"
>


          {messages.length === 0 ? (
            <div className="text-center text-zinc-500 mt-24 text-base sm:text-lg">
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
              <div className="flex gap-1.5 mt-3">
                <span className="w-2.5 h-2.5 bg-zinc-400 rounded-full animate-bounce"></span>
                <span className="w-2.5 h-2.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-.3s]"></span>
                <span className="w-2.5 h-2.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-.15s]"></span>
              </div>
            </div>
          )}

          {/* Render the “Jump to latest” as absolute so it DOES NOT push content */}
          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true);
                autoScrollRef.current = true;
                smartScrollToBottom("smooth");
              }}
              className="absolute right-4 bottom-4 z-10 flex items-center gap-1.5 bg-zinc-800/90 hover:bg-zinc-700 text-white text-sm px-3.5 py-2.5 rounded-full shadow-lg border border-zinc-700"
              title="Jump to latest"
            >
              <ArrowDown size={16} />
              New messages
            </button>
          )}

          {/* explicit scroll anchor at the end */}
          <div className="scroll-anchor" ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="w-full max-w-4xl mt-5 border-t border-zinc-800 bg-zinc-950 p-4 rounded-2xl">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Message ChatGPT..."
              className="flex-1 bg-zinc-800 text-zinc-50 placeholder-zinc-500 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-base sm:text-lg"
            />
            <button
              onClick={handleSend}
              disabled={loading || !activeChatId}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-medium transition text-base"
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
