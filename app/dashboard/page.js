"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { getClientAuth, getClientDb } from "@/lib/firebase";
import { 
  MessageSquare, 
  Plus, 
  LogOut, 
  Mic, 
  Paperclip, 
  Send, 
  User, 
  Sparkles, 
  ShieldAlert,
  Menu,
  X
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("Student");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    let messagesUnsub = null;
    const auth = getClientAuth();
    const db = getClientDb();

    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.replace("/login");
        return;
      }

      setUser(currentUser);
      const roleDoc = await getDoc(doc(db, "users", currentUser.uid));
      setRole(roleDoc.exists() ? roleDoc.data().role || "Student" : "Student");

      const messagesRef = collection(db, "users", currentUser.uid, "messages");
      const messagesQuery = query(messagesRef, orderBy("createdAt", "asc"));

      if (messagesUnsub) {
        messagesUnsub();
      }

      messagesUnsub = onSnapshot(messagesQuery, (snapshot) => {
        setMessages(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      });
    });

    return () => {
      unsub();
      if (messagesUnsub) {
        messagesUnsub();
      }
    };
  }, [router]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const canOpenAdmin = useMemo(
    () => String(role).toLowerCase() === "admin",
    [role]
  );

  async function handleAsk(event) {
    event.preventDefault();

    if (!question.trim() || !user || loading) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: question.trim() }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Chat request failed");
      }

      setQuestion("");
    } catch (err) {
      setError(err.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    const auth = getClientAuth();
    await signOut(auth);
    router.replace("/login");
  }

  return (
    <main className="flex h-screen w-full bg-[#F4F2FA] font-sans overflow-hidden">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-[#ECE8F5] transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#7B61FF] to-[#5F2C82] text-white shadow-md">
              <Sparkles size={16} />
            </div>
            <h1 className="text-[18px] font-bold text-[#1E1E1E]">Amity AI</h1>
          </div>
          <button className="md:hidden text-[#6B6B6B]" onClick={() => setIsSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="px-4 pb-4">
          <button className="group flex w-full items-center gap-3 rounded-full bg-white px-4 py-3 text-[14px] font-medium text-[#1E1E1E] shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7B61FF] text-white transition-colors group-hover:bg-[#5F2C82]">
              <Plus size={14} />
            </div>
            New Chat
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <div className="mb-6">
            <h3 className="mb-3 px-2 text-[12px] font-semibold uppercase tracking-wider text-[#6B6B6B]">Today</h3>
            <div className="space-y-2">
              <button className="flex w-full items-center gap-3 rounded-[12px] bg-white px-3 py-2.5 text-left text-[13px] text-[#1E1E1E] shadow-sm transition-all hover:scale-[1.02] hover:shadow-md">
                <MessageSquare size={16} className="text-[#7B61FF]" />
                <span className="truncate">University Policies</span>
              </button>
              <button className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-[13px] text-[#6B6B6B] transition-all hover:bg-white/50">
                <MessageSquare size={16} />
                <span className="truncate">Exam Schedules</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="mt-auto border-t border-[#D1C4E9]/30 p-4">
          <div className="mb-4 flex items-center gap-3 rounded-[14px] bg-white p-3 shadow-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F4F2FA] text-[#7B61FF]">
              <User size={16} />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-[13px] font-medium text-[#1E1E1E]">{user?.email || "Student"}</p>
              <p className="text-[11px] text-[#6B6B6B]">{role}</p>
            </div>
          </div>

          <div className="space-y-1">
            {canOpenAdmin && (
              <button
                onClick={() => router.push("/admin-upload")}
                className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-[13px] font-medium text-[#1E1E1E] transition-colors hover:bg-white/60"
              >
                <ShieldAlert size={16} className="text-[#7B61FF]" />
                Admin Dashboard
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-[13px] font-medium text-red-500 transition-colors hover:bg-red-50"
            >
              <LogOut size={16} />
              Log Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <section className="flex flex-1 flex-col p-4 md:p-6">
        <div className="flex h-full flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_15px_40px_rgba(0,0,0,0.08)]">
          
          {/* Chat Header */}
          <header className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <button className="md:hidden text-[#6B6B6B]" onClick={() => setIsSidebarOpen(true)}>
                <Menu size={24} />
              </button>
              <div>
                <h2 className="text-[16px] font-semibold text-[#1E1E1E]">Amity Assistant</h2>
                <p className="text-[12px] text-[#6B6B6B]">Powered by RAG & AI</p>
              </div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F4F2FA] text-[#7B61FF]">
              <Sparkles size={16} />
            </div>
          </header>

          {/* Messages Area */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-6 space-y-6"
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F4F2FA] text-[#7B61FF]">
                  <Sparkles size={32} />
                </div>
                <h3 className="text-[18px] font-semibold text-[#1E1E1E]">How can I help you today?</h3>
                <p className="mt-2 max-w-sm text-[14px] text-[#6B6B6B]">
                  Ask me anything about university policies, schedules, or course materials.
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex w-full ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] md:max-w-[75%] rounded-[16px] p-4 text-[14px] leading-relaxed shadow-sm ${
                      message.role === "user"
                        ? "bg-[#F4F2FA] text-[#1E1E1E] rounded-tr-sm"
                        : "bg-white border border-gray-100 text-[#1E1E1E] rounded-tl-sm shadow-[0_4px_15px_rgba(0,0,0,0.03)]"
                    }`}
                  >
                    <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-gray-50 prose-pre:text-gray-800">
                      <ReactMarkdown>{message.content || ""}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex w-full justify-start">
                <div className="flex max-w-[85%] items-center gap-2 rounded-[16px] rounded-tl-sm border border-gray-100 bg-white p-4 shadow-[0_4px_15px_rgba(0,0,0,0.03)]">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-[#7B61FF]"></div>
                    <div className="h-2 w-2 animate-bounce rounded-full bg-[#7B61FF] [animation-delay:0.2s]"></div>
                    <div className="h-2 w-2 animate-bounce rounded-full bg-[#7B61FF] [animation-delay:0.4s]"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 md:p-6">
            <form
              onSubmit={handleAsk}
              className="relative flex items-center rounded-full bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-100 p-2"
            >
              <button type="button" className="ml-2 p-2 text-[#6B6B6B] transition-colors hover:text-[#7B61FF]">
                <Paperclip size={20} />
              </button>
              
              <input
                type="text"
                placeholder="Ask Amity AI..."
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                className="flex-1 bg-transparent px-4 py-3 text-[14px] text-[#1E1E1E] outline-none placeholder:text-[#6B6B6B]"
              />
              
              <button type="button" className="p-2 text-[#6B6B6B] transition-colors hover:text-[#7B61FF]">
                <Mic size={20} />
              </button>
              
              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="ml-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#7B61FF] text-white shadow-md transition-all duration-200 hover:scale-105 hover:bg-[#5F2C82] disabled:scale-100 disabled:opacity-50"
              >
                <Send size={18} className="ml-0.5" />
              </button>
            </form>
            {error && <p className="mt-3 text-center text-[12px] text-red-500">{error}</p>}
          </div>

        </div>
      </section>
    </main>
  );
}
