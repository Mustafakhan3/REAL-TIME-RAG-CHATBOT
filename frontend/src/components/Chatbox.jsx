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
  const chatEndRef = useRef(null);
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

  function atBottom(el, eps = 12) {
    if (!el) return true;
    const { scrollTop, scrollHeight, clientHeight } = el;
    return scrollTop + clientHeight >= scrollHeight - eps;
  }

  const smartScrollToBottom = (behavior = "auto") => {
    if (autoScrollRef.current) chatEndRef.current?.scrollIntoView({ behavior });
  };

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

  useEffect(() => {
    if (!uid || !activeChatId) return;
    const colRef = collection(
      db,
      "users",
      uid,
      "chats",
      activeChatId,
      "messages"
    );
    const q = query(colRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const rows = [];
      snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
      setMessages(rows);
      requestAnimationFrame(() => smartScrollToBottom("auto"));
    });
    return () => unsub();
  }, [uid, activeChatId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onGestureStart = () => {
      // If user tries to interact and is NOT at bottom, stop following
      if (!atBottom(el)) {
        setAutoScroll(false);
        autoScrollRef.current = false;
      }
    };

    const onScroll = () => {
      // ALWAYS allow user to unpin even during streaming
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

  useLayoutEffect(() => {
    if (autoScrollRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [messages, isStreaming]);

  const handleDeleteChat = async (id) => {
    if (!uid || !id) return;
    if (!confirm("Delete this chat permanently?")) return;
    setDeletingId(id);
    try {
      const msgsCol = collection(
        db,
        "users",
        uid,
        "chats",
        id,
        "messages"
      );
      const msgs = await getDocs(query(msgsCol, limit(500)));
      await Promise.all(msgs.docs.map((d) => deleteDoc(d.ref)));
      await deleteDoc(doc(db, "users", uid, "chats", id));
      if (activeChatId === id) await createNewChat();
    } finally {
      setDeletingId(null);
    }
  };

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
    const lower = text.toLowerCase();

    // ✅ Detect self-introduction / personal info messages (for ALL users)
    const isSelfIntro =
      /^(\s*)?(my name is|i am|i'm|call me|this is)\b/i.test(text) ||
      /\b(i live in|i am from|i work as|i study|i like|i love|my hobby|my interest)\b/.test(
        lower
      );

    setInput("");
    setLoading(true);

    const el = scrollRef.current;
    const follow = atBottom(el);
    setAutoScroll(follow);
    autoScrollRef.current = follow;

    await addDoc(
      collection(db, "users", uid, "chats", chatId, "messages"),
      {
        role: "user",
        content: text,
        createdAt: serverTimestamp(),
      }
    );

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
      const respSources = Array.isArray(res.data.sources)
        ? res.data.sources
        : [];

      // ✅ If it's a self-introduction / personal info message,
      //    do not show any sources (for ANY user)
      const finalSources = isSelfIntro ? [] : respSources;

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

      setIsStreaming(false);
      setStreamText("");

      await new Promise((r) => requestAnimationFrame(r));

      await addDoc(
        collection(db, "users", uid, "chats", chatId, "messages"),
        {
          role: "assistant",
          content: fullReply,
          sources: finalSources,
          createdAt: serverTimestamp(),
        }
      );

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
    // fixed on mobile to escape parent max-width, normal on sm+
    <div className="fixed inset-0 sm:relative sm:inset-auto sm:h-screen sm:w-full
                    flex bg-zinc-950 text-white overflow-hidden">
      
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 sm:hidden z-30"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed sm:static inset-y-0 left-0 z-40
        w-[85vw] max-w-[19rem] sm:w-60 md:w-64 lg:w-72
        bg-zinc-900 border-r border-zinc-800 p-4 sm:p-5
        transform transition-transform duration-300 ease-in-out
        h-full overflow-y-auto
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"}`}
      >
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <h2 className="text-lg font-semibold text-zinc-100 tracking-tight">
            Saved Chats
          </h2>
          <button
            className="sm:hidden text-zinc-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            title="Close sidebar"
          >
            <X size={22} />
          </button>
        </div>

        <button
          onClick={handleNewChat}
          className="w-full mb-4 sm:mb-5 flex items-center justify-center gap-2
             bg-indigo-600 hover:bg-indigo-500 text-white font-medium
             text-sm sm:text-base px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl shadow-md hover:shadow-lg
             transition-all duration-200"
          title="Start a new chat"
          aria-label="New chat"
        >
          <Plus size={18} />
          <span>New Chat</span>
        </button>

        <div className="space-y-2">
          {chats.length === 0 ? (
            <p className="text-zinc-500 text-sm px-2">No chats yet</p>
          ) : (
            chats.map((c) => {
              const t = (c.title || "Untitled").trim();
              const isActive = activeChatId === c.id;

              return (
                <div
                  key={c.id}
                  className={`
                    group relative flex items-center gap-2
                    h-11 sm:h-12 px-3 rounded-lg cursor-pointer
                    transition-all duration-150
                    ${
                      isActive
                        ? "bg-zinc-800/80 text-white"
                        : "bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
                    }
                  `}
                  onClick={() => {
                    setActiveChatId(c.id);
                    setSidebarOpen(false);
                  }}
                  title={t}
                >
                  {isActive && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-indigo-500" />
                  )}

                  <span className="min-w-0 flex-1 text-sm font-medium truncate pl-1">
                    {t}
                  </span>

                  <button
                    className="flex-shrink-0 p-2 rounded-md
                      text-zinc-400 hover:text-red-400 hover:bg-zinc-700/40
                      transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteChat(c.id);
                    }}
                    disabled={deletingId === c.id}
                    title="Delete"
                    aria-label="Delete chat"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 w-full p-2 sm:p-4 md:p-4">
        <div className="w-full flex items-center justify-between sm:hidden mb-2">
          <button
            className="text-zinc-300 hover:text-white"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            title="Open sidebar"
          >
            <Menu size={24} />
          </button>
          <h1 className="text-base font-semibold">Chatbot</h1>
          <div className="w-6" />
        </div>

        <div
          ref={scrollRef}
          className="chat-scroll relative flex-1 min-h-0 w-full
                     overflow-y-auto overflow-x-hidden
                     px-2 sm:px-4 py-3 space-y-3
                     bg-zinc-900 border border-zinc-800
                     rounded-2xl sm:rounded-3xl shadow-2xl
                     lg:max-w-5xl lg:mx-auto"
        >
          {messages.length === 0 ? (
            <div className="text-center text-zinc-500 mt-12 text-sm sm:text-base">
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

          {isStreaming && (
            <Message text={streamText} sender="bot" sources={[]} />
          )}

          {loading && !isStreaming && (
            <div className="flex justify-start px-4">
              <div className="flex gap-1.5 mt-3">
                <span className="w-2.5 h-2.5 bg-zinc-400 rounded-full animate-bounce"></span>
                <span className="w-2.5 h-2.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-.3s]"></span>
                <span className="w-2.5 h-2.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-.15s]"></span>
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
              className="absolute right-3 bottom-3 z-10 flex items-center gap-1.5
                         bg-zinc-800/90 hover:bg-zinc-700 text-white text-xs sm:text-sm
                         px-3 py-2 rounded-full shadow-lg border border-zinc-700"
              title="Jump to latest"
            >
              <ArrowDown size={14} />
              New messages
            </button>
          )}

          <div ref={chatEndRef} />
        </div>

        <div
          className="w-full mt-3 sm:mt-4 border-t border-zinc-800 bg-zinc-950
                     p-2.5 sm:p-4 rounded-xl sm:rounded-2xl
                     lg:max-w-4xl lg:mx-auto"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Message your RAG assistant…"
              className="flex-1 min-w-0 bg-zinc-800 text-zinc-50 placeholder-zinc-500
                         px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl outline-none
                         focus:ring-2 focus:ring-indigo-500 text-sm sm:text-base"
            />
            <button
              onClick={handleSend}
              disabled={loading || !activeChatId}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
                         text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl
                         font-medium transition text-sm sm:text-base"
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
