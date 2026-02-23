"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  limit as fbLimit,
  writeBatch,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getClientAuth, getClientDb } from "@/lib/firebase";
import {
  MessageSquare,
  Plus,
  LogOut,
  Mic,
  MicOff,
  Send,
  User,
  ShieldAlert,
  Menu,
  X,
  Bot,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FloatingOrb } from "@/components/ui/Orb";

// ─── Sidebar ─────────────────────────────────────────────

function Sidebar({
  isOpen,
  setIsOpen,
  user,
  role,
  onSignOut,
  onNewChat,
  conversations,
  activeConvId,
  onSelectConv,
  onDeleteConv,
}) {
  const isAdmin = String(role).toLowerCase() === "admin";
  const router = useRouter();

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-[#1E1E24] bg-[#0B0B0F] transition-transform md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#A855F7] to-[#7B2CBF]">
              <Bot className="text-white" size={18} />
            </div>
            <span className="text-[16px] font-semibold tracking-tight text-white">
              Amity AI
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-[#A1A1AA] md:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* New Chat */}
        <div className="px-4">
          <button
            onClick={onNewChat}
            className="flex w-full items-center gap-3 rounded-[12px] border border-[#27272A] bg-[#18181B] px-4 py-3 text-[14px] font-medium text-white transition-all hover:border-[#A855F7]/50 hover:bg-[#27272A] hover:shadow-[0_0_15px_rgba(168,85,247,0.15)]"
          >
            <Plus size={18} className="text-[#A855F7]" />
            New Chat
          </button>
        </div>

        {/* Navigation + Chat History */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
          {isAdmin && (
            <button
              onClick={() => router.push("/admin-upload")}
              className="group mb-3 flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-[14px] text-[#A1A1AA] transition-all hover:bg-[#18181B] hover:text-white"
            >
              <ShieldAlert
                size={18}
                className="text-[#71717A] group-hover:text-[#A1A1AA]"
              />
              Admin Console
            </button>
          )}

          <div className="mb-2 mt-2 px-2 text-[11px] font-bold uppercase tracking-wider text-[#52525B]">
            Recent Chats
          </div>

          {conversations.length === 0 && (
            <p className="px-3 text-[12px] text-[#52525B]">No chats yet</p>
          )}

          {conversations.map((conv) => (
            <div key={conv.id} className="group relative">
              <button
                onClick={() => onSelectConv(conv.id)}
                className={`flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-[14px] transition-all ${
                  conv.id === activeConvId
                    ? "bg-[#27272A] font-medium text-white"
                    : "text-[#A1A1AA] hover:bg-[#18181B] hover:text-white"
                }`}
              >
                <MessageSquare
                  size={16}
                  className={
                    conv.id === activeConvId
                      ? "shrink-0 text-[#A855F7]"
                      : "shrink-0 text-[#71717A]"
                  }
                />
                <span className="truncate">{conv.title || "Untitled"}</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteConv(conv.id);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#52525B] opacity-0 transition-all hover:bg-[#27272A] hover:text-red-400 group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </nav>

        {/* User Footer */}
        <div className="border-t border-[#1E1E24] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#27272A] text-[#A1A1AA] ring-2 ring-[#0B0B0F]">
                <User size={16} />
              </div>
              <div className="flex flex-col">
                <span className="max-w-[120px] truncate text-[13px] font-medium text-white">
                  {user?.email?.split("@")[0] || "User"}
                </span>
                <span className="text-[11px] text-[#71717A]">{role}</span>
              </div>
            </div>
            <button
              onClick={onSignOut}
              className="text-[#71717A] transition-colors hover:text-white"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── Message Bubble ──────────────────────────────────────

function MessageBubble({ role, content }) {
  const isUser = role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-[20px] px-5 py-3.5 text-[15px] leading-relaxed shadow-sm ${
          isUser
            ? "rounded-br-none bg-[#27272A] text-white"
            : "bg-transparent text-[#E4E4E7]"
        }`}
      >
        {isUser ? (
          content
        ) : (
          <div className="markdown-content prose prose-invert max-w-none text-[15px]">
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="mb-2 list-disc space-y-1 pl-4">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-2 list-decimal space-y-1 pl-4">
                    {children}
                  </ol>
                ),
                li: ({ children }) => <li className="pl-1">{children}</li>,
                h1: ({ children }) => (
                  <h1 className="mb-2 mt-4 text-lg font-bold">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="mb-2 mt-4 text-base font-bold">{children}</h2>
                ),
                code: ({ inline, children }) =>
                  inline ? (
                    <code className="rounded bg-[#18181B] px-1.5 py-0.5 font-mono text-[13px] text-[#A855F7]">
                      {children}
                    </code>
                  ) : (
                    <pre className="my-2 overflow-x-auto rounded-lg border border-[#27272A] bg-[#18181B] p-3 font-mono text-[13px] text-[#E4E4E7]">
                      <code>{children}</code>
                    </pre>
                  ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    className="text-[#A855F7] hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Voice Input Hook ────────────────────────────────────

function useVoiceInput(onResult) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) onResult(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
  }, [onResult]);

  const toggle = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;

    if (isListening) {
      rec.stop();
      setIsListening(false);
    } else {
      rec.start();
      setIsListening(true);
    }
  }, [isListening]);

  return { isListening, toggle, supported: !!recognitionRef.current };
}

// ─── Main Page ───────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("Student");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Conversation State
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);

  // Chat State
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesUnsubRef = useRef(null);
  const convsUnsubRef = useRef(null);

  // Voice
  const handleVoiceResult = useCallback((transcript) => {
    setQuestion((q) => (q ? q + " " + transcript : transcript));
  }, []);
  const { isListening, toggle: toggleVoice } =
    useVoiceInput(handleVoiceResult);

  // ── Auth & Conversations List ──────────────────────────
  useEffect(() => {
    const auth = getClientAuth();
    const db = getClientDb();

    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.replace("/login");
        return;
      }
      setUser(currentUser);

      // Fetch Role
      const roleSnap = await getDoc(doc(db, "users", currentUser.uid));
      setRole(
        roleSnap.exists() ? roleSnap.data().role || "Student" : "Student"
      );

      // Realtime Conversations (last 15)
      const convsQuery = query(
        collection(db, "users", currentUser.uid, "conversations"),
        orderBy("updatedAt", "desc"),
        fbLimit(15)
      );

      if (convsUnsubRef.current) convsUnsubRef.current();

      convsUnsubRef.current = onSnapshot(convsQuery, (snapshot) => {
        setConversations(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        );
      });
    });

    return () => {
      unsubAuth();
      if (convsUnsubRef.current) convsUnsubRef.current();
      if (messagesUnsubRef.current) messagesUnsubRef.current();
    };
  }, [router]);

  // ── Listen to Active Conversation's Messages ──────────
  useEffect(() => {
    if (messagesUnsubRef.current) {
      messagesUnsubRef.current();
      messagesUnsubRef.current = null;
    }

    if (!user || !activeConvId) {
      setMessages([]);
      return;
    }

    const db = getClientDb();
    const msgsQuery = query(
      collection(
        db,
        "users",
        user.uid,
        "conversations",
        activeConvId,
        "messages"
      ),
      orderBy("createdAt", "asc")
    );

    messagesUnsubRef.current = onSnapshot(msgsQuery, (snapshot) => {
      setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      if (messagesUnsubRef.current) messagesUnsubRef.current();
    };
  }, [user, activeConvId]);

  // ── Scroll to bottom ──────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Handlers ──────────────────────────────────────────

  const handleSignOut = async () => {
    await signOut(getClientAuth());
    router.replace("/login");
  };

  const handleNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setQuestion("");
  };

  const handleSelectConv = (convId) => {
    setActiveConvId(convId);
    setIsSidebarOpen(false);
  };

  const handleDeleteConv = async (convId) => {
    if (!user) return;
    const db = getClientDb();

    // Delete all messages in conversation
    const msgsCol = collection(
      db,
      "users",
      user.uid,
      "conversations",
      convId,
      "messages"
    );
    const msgsSnap = await getDocs(msgsCol);
    const batch = writeBatch(db);
    msgsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, "users", user.uid, "conversations", convId));
    await batch.commit();

    if (activeConvId === convId) {
      setActiveConvId(null);
      setMessages([]);
    }
  };

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim() || !user || loading) return;

    const input = question.trim();
    setQuestion("");
    setLoading(true);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          question: input,
          conversationId: activeConvId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Failed to fetch");

      // If new conversation was created, set it active
      if (!activeConvId && data.conversationId) {
        setActiveConvId(data.conversationId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0E0E12] font-sans text-white selection:bg-[#A855F7]/30">
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        user={user}
        role={role}
        onSignOut={handleSignOut}
        onNewChat={handleNewChat}
        conversations={conversations}
        activeConvId={activeConvId}
        onSelectConv={handleSelectConv}
        onDeleteConv={handleDeleteConv}
      />

      <main className="relative flex flex-1 flex-col transition-all duration-300 md:ml-[280px]">
        {/* Mobile Header */}
        <header className="flex h-16 items-center justify-between border-b border-[#1E1E24] px-4 md:hidden">
          <div className="flex items-center gap-2">
            <Bot className="text-[#A855F7]" size={24} />
            <span className="font-semibold">Amity AI</span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-[#A1A1AA]"
          >
            <Menu size={24} />
          </button>
        </header>

        {/* Chat Area */}
        <div className="relative flex-1 overflow-y-auto p-4 md:p-8">
          {!activeConvId && messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <FloatingOrb />

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="z-10 max-w-2xl"
                style={{ paddingTop: 20 }}
              >
                <h1 className="mb-6 text-[36px] font-semibold leading-tight tracking-tight text-white md:text-[42px]">
                  Unlock knowledge with <br />
                  <span className="bg-gradient-to-r from-[#A855F7] to-[#D8B4FE] bg-clip-text text-transparent drop-shadow-sm">
                    Amity Intelligence
                  </span>
                </h1>

                <div className="flex flex-wrap justify-center gap-3">
                  {[
                    "Summarize the latest syllabus",
                    "How to apply for leave?",
                    "Exam schedule details",
                    "Safety guidelines",
                  ].map((chip, i) => (
                    <button
                      key={i}
                      onClick={() => setQuestion(chip)}
                      className="rounded-full border border-[#27272A] bg-[#18181B]/50 px-4 py-2 text-[13px] text-[#A1A1AA] transition-all hover:border-[#A855F7]/40 hover:bg-[#27272A] hover:text-white"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-32 pt-10">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                />
              ))}
              {loading && (
                <div className="ml-4 flex items-center gap-2 text-[#71717A]">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-[#A855F7]" />
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-[#A855F7]"
                    style={{ animationDelay: "0.15s" }}
                  />
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-[#A855F7]"
                    style={{ animationDelay: "0.3s" }}
                  />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#0E0E12] via-[#0E0E12]/90 to-transparent p-4 pb-6 md:pb-8">
          <div className="mx-auto max-w-3xl">
            <form
              onSubmit={handleAsk}
              className="relative flex items-center gap-3 rounded-[24px] border border-[#27272A] bg-[#0E0E12]/80 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl transition-all focus-within:border-[#A855F7]/50 focus-within:shadow-[0_0_40px_-10px_rgba(168,85,247,0.15)]"
            >
              <button
                type="button"
                onClick={handleNewChat}
                className="ml-2 flex h-8 w-8 items-center justify-center rounded-full text-[#71717A] transition-colors hover:bg-[#27272A] hover:text-white"
                title="New Chat"
              >
                <Plus size={18} />
              </button>

              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask anything..."
                className="flex-1 bg-transparent px-2 text-[15px] text-white placeholder-[#52525B] outline-none"
              />

              <div className="flex items-center gap-2 pr-2">
                {/* Voice Input Button */}
                <button
                  type="button"
                  onClick={toggleVoice}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                    isListening
                      ? "animate-pulse bg-red-500/20 text-red-400"
                      : "text-[#71717A] hover:bg-[#27272A] hover:text-white"
                  }`}
                  title={isListening ? "Stop listening" : "Voice input"}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                <button
                  type="submit"
                  disabled={!question.trim() || loading}
                  className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#A855F7] text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-transform hover:scale-105 hover:bg-[#9333EA] disabled:opacity-50 disabled:hover:scale-100"
                >
                  {loading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <Send size={18} className="ml-0.5" />
                  )}
                </button>
              </div>
            </form>
            <div className="mt-3 text-center text-[11px] text-[#52525B] select-none">
              AI can make mistakes. Verify important information.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
