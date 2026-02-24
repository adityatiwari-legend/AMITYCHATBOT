"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getClientAuth, getClientDb } from "@/lib/firebase";
import { Sparkles, Mail, Lock, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const auth = getClientAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/dashboard");
      }
    });

    return () => unsub();
  }, [router]);

  async function ensureUserDoc(user) {
    const db = getClientDb();
    const userRef = doc(db, "users", user.uid);
    const existing = await getDoc(userRef);

    if (!existing.exists()) {
      await setDoc(userRef, {
        email: user.email || "",
        role: "Student",
        createdAt: serverTimestamp(),
      });
    }
  }

  async function handleAuth(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const auth = getClientAuth();

      if (isRegisterMode) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await ensureUserDoc(cred.user);
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await ensureUserDoc(cred.user);
      }

      router.replace("/dashboard");
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#3A1C71] via-[#5F2C82] to-[#2A0845] p-4 font-sans">
      <div className="relative w-full max-w-md">
        <div className="absolute -inset-1 rounded-[24px] bg-gradient-to-b from-[#7B61FF]/40 to-transparent opacity-50 blur-2xl"></div>
        <div className="relative flex flex-col overflow-hidden rounded-[20px] bg-white p-8 shadow-[0_20px_60px_rgba(123,97,255,0.35)]">
          
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#7B61FF] to-[#5F2C82] text-white shadow-lg">
              <Sparkles size={32} />
            </div>
            <h1 className="text-[24px] font-bold text-[#1E1E1E]">
              Welcome to Amity AI
            </h1>
            <p className="mt-2 text-[14px] text-[#6B6B6B]">
              {isRegisterMode ? "Create your student account" : "Sign in to continue"}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B6B6B]" size={20} />
              <input
                type="email"
                required
                placeholder="Email Address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-[16px] border border-gray-200 bg-[#F4F2FA] py-4 pl-12 pr-4 text-[14px] text-[#1E1E1E] outline-none transition-all duration-200 focus:border-[#7B61FF] focus:bg-white focus:ring-2 focus:ring-[#7B61FF]/20"
              />
            </div>
            
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B6B6B]" size={20} />
              <input
                type="password"
                required
                minLength={6}
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-[16px] border border-gray-200 bg-[#F4F2FA] py-4 pl-12 pr-4 text-[14px] text-[#1E1E1E] outline-none transition-all duration-200 focus:border-[#7B61FF] focus:bg-white focus:ring-2 focus:ring-[#7B61FF]/20"
              />
            </div>

            {error && (
              <div className="rounded-[12px] bg-red-50 p-3 text-center text-[13px] text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-full bg-[#7B61FF] py-4 text-[16px] font-semibold text-white shadow-[0_10px_20px_rgba(123,97,255,0.3)] transition-all duration-200 hover:scale-[1.02] hover:bg-[#5F2C82] disabled:opacity-70"
            >
              {loading ? "Please wait..." : isRegisterMode ? "Create Account" : "Sign In"}
              {!loading && <ArrowRight className="transition-transform duration-200 group-hover:translate-x-1" size={20} />}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setIsRegisterMode(!isRegisterMode)}
              className="text-[14px] font-medium text-[#6B6B6B] transition-colors hover:text-[#7B61FF]"
            >
              {isRegisterMode
                ? "Already have an account? Sign in"
                : "Don't have an account? Register"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
