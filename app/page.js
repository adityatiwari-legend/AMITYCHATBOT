"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";
import { Sparkles, FileText, Image as ImageIcon, Languages, Mic, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getClientAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/dashboard");
      } else {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F2FA]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#7B61FF] border-t-transparent"></div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#3A1C71] via-[#5F2C82] to-[#2A0845] p-8 font-sans">
      <div className="mx-auto flex w-full max-w-6xl flex-col-reverse items-center gap-16 lg:flex-row">
        
        {/* Left: Floating Chat Preview */}
        <div className="relative w-full max-w-lg flex-1">
          <div className="absolute -inset-1 rounded-[24px] bg-gradient-to-b from-[#7B61FF]/40 to-transparent opacity-50 blur-2xl"></div>
          <div className="relative flex h-[600px] flex-col overflow-hidden rounded-[20px] bg-[#F4F2FA] shadow-[0_20px_60px_rgba(123,97,255,0.35)]">
            {/* Chat Header */}
            <div className="flex items-center gap-3 border-b border-white/50 bg-white/60 p-4 backdrop-blur-md">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#7B61FF] to-[#5F2C82] text-white shadow-md">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-[#1E1E1E]">Amity AI</h3>
                <p className="text-xs text-[#6B6B6B]">Always here to help</p>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              <div className="flex w-max max-w-[85%] flex-col gap-1 rounded-[14px] rounded-tl-sm bg-white p-4 text-[14px] text-[#1E1E1E] shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
                <p>Hello! I'm Amity AI. How can I assist you with your university studies today?</p>
              </div>
              <div className="ml-auto flex w-max max-w-[85%] flex-col gap-1 rounded-[14px] rounded-tr-sm bg-[#7B61FF] p-4 text-[14px] text-white shadow-[0_4px_15px_rgba(123,97,255,0.2)]">
                <p>Can you summarize the latest syllabus for Computer Science?</p>
              </div>
              <div className="flex w-max max-w-[85%] flex-col gap-1 rounded-[14px] rounded-tl-sm bg-white p-4 text-[14px] text-[#1E1E1E] shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
                <p>Certainly! The latest syllabus focuses heavily on Artificial Intelligence, Machine Learning, and Cloud Computing. Would you like a detailed breakdown?</p>
              </div>
            </div>

            {/* Tool Cards Row */}
            <div className="bg-white/80 p-4 backdrop-blur-md">
              <div className="flex justify-between gap-2">
                {[
                  { icon: FileText, label: "Files" },
                  { icon: ImageIcon, label: "Images" },
                  { icon: Languages, label: "Translate" },
                  { icon: Mic, label: "Audio" },
                ].map((tool, i) => (
                  <div key={i} className="flex cursor-pointer flex-col items-center gap-1 rounded-[12px] bg-white p-2 text-[#6B6B6B] shadow-sm transition-all duration-200 hover:scale-105 hover:text-[#7B61FF] hover:shadow-md">
                    <tool.icon size={20} />
                    <span className="text-[10px] font-medium">{tool.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Branding & CTA */}
        <div className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/10 shadow-[0_0_40px_rgba(123,97,255,0.5)] backdrop-blur-xl">
            <Sparkles className="text-white" size={40} />
          </div>
          
          <h1 className="mb-4 text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
            Amity AI
          </h1>
          <p className="mb-8 text-xl font-medium text-white/80">
            Your Personal University Assistant
          </p>

          <div className="mb-10 flex flex-wrap justify-center gap-3 lg:justify-start">
            {["ChatbotUI", "PersonalAI", "VoiceAssistant", "RAG Powered"].map((tag) => (
              <span key={tag} className="rounded-full bg-white/10 px-4 py-1.5 text-[13px] font-medium text-white backdrop-blur-md border border-white/20">
                {tag}
              </span>
            ))}
          </div>

          <Link 
            href="/login"
            className="group flex items-center gap-2 rounded-full bg-white px-8 py-4 text-[16px] font-semibold text-[#3A1C71] shadow-[0_15px_40px_rgba(0,0,0,0.2)] transition-all duration-200 hover:scale-105 hover:bg-[#F4F2FA]"
          >
            Get Started
            <ArrowRight className="transition-transform duration-200 group-hover:translate-x-1" size={20} />
          </Link>
        </div>

      </div>
    </main>
  );
}
