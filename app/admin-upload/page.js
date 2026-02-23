"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getClientAuth, getClientDb } from "@/lib/firebase";
import {
  ArrowLeft,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Type,
} from "lucide-react";
import Link from "next/link";

export default function AdminUploadPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("Student");
  const [authReady, setAuthReady] = useState(false);
  const [file, setFile] = useState(null);
  const [pastedText, setPastedText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(null); // { message, chunksInserted, totalChunks }
  const [error, setError] = useState("");

  useEffect(() => {
    const auth = getClientAuth();
    const db = getClientDb();

    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setAuthReady(true);
        router.replace("/login");
        return;
      }

      setUser(currentUser);

      try {
        const roleDoc = await getDoc(doc(db, "users", currentUser.uid));
        const roleValue = roleDoc.exists()
          ? roleDoc.data().role || "Student"
          : "Student";
        setRole(roleValue);

        if (String(roleValue).trim().toLowerCase() !== "admin") {
          router.replace("/dashboard");
        }
      } catch {
        setRole("Student");
        router.replace("/dashboard");
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, [router]);

  const isAdmin = useMemo(
    () => String(role).trim().toLowerCase() === "admin",
    [role]
  );

  const hasInput = file || pastedText.trim().length > 0;

  async function handleUpload(event) {
    event.preventDefault();

    if (!hasInput || !user || !isAdmin || uploading) return;

    setUploading(true);
    setStatus(null);
    setError("");

    try {
      const token = await user.getIdToken();
      const formData = new FormData();

      if (file) {
        formData.append("file", file);
      } else {
        formData.append("text", pastedText);
      }

      const response = await fetch("/api/upload-document", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        const detail = payload.details?.[0]?.message;
        throw new Error(
          (payload.error || "Upload failed") + (detail ? ` — ${detail}` : "")
        );
      }

      setStatus({
        message: "Upload successful!",
        chunksInserted: payload.chunksInserted,
        totalChunks: payload.totalChunks,
      });
      setFile(null);
      setPastedText("");
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (!authReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F2FA]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#7B61FF] border-t-transparent"></div>
      </main>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#F4F2FA] font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F2FA] text-[#6B6B6B] transition-colors hover:bg-[#E2DDF0] hover:text-[#7B61FF]"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-[18px] font-bold text-[#1E1E1E]">
                Admin Dashboard
              </h1>
              <p className="text-[13px] text-[#6B6B6B]">
                Knowledge Base Management
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-600">
            <ShieldAlert size={14} />
            Admin Access
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl p-6 py-10">
        <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_15px_40px_rgba(0,0,0,0.08)]">
          {/* Hero */}
          <div className="border-b border-gray-100 bg-gradient-to-r from-[#F4F2FA] to-white p-8">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#7B61FF] shadow-sm">
              <UploadCloud size={32} />
            </div>
            <h2 className="text-[24px] font-bold text-[#1E1E1E]">
              Upload Documents
            </h2>
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[#6B6B6B]">
              Upload a PDF or .txt file, or paste text directly. The content
              will be chunked, embedded, and stored in the vector database for
              Amity AI to use.
            </p>
          </div>

          <div className="p-8">
            <form onSubmit={handleUpload} className="space-y-6">
              {/* File Drop Zone */}
              <div>
                <label className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-[#6B6B6B]">
                  <FileText size={14} />
                  Upload File (PDF or .txt)
                </label>
                <div className="relative flex flex-col items-center justify-center rounded-[16px] border-2 border-dashed border-[#D1C4E9] bg-[#F4F2FA]/50 p-10 text-center transition-colors hover:bg-[#F4F2FA]">
                  <input
                    type="file"
                    accept="application/pdf,.pdf,.txt,text/plain"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] || null);
                      if (e.target.files?.[0]) setPastedText("");
                    }}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                  <FileText size={40} className="mb-4 text-[#7B61FF]" />
                  <h3 className="text-[16px] font-semibold text-[#1E1E1E]">
                    {file ? file.name : "Click or drag a file to upload"}
                  </h3>
                  <p className="mt-1 text-[13px] text-[#6B6B6B]">
                    {file
                      ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                      : "PDF or plain-text files, max 10 MB"}
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-[13px] font-medium text-[#6B6B6B]">
                  OR
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              {/* Paste Textarea */}
              <div>
                <label className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-[#6B6B6B]">
                  <Type size={14} />
                  Paste Text Directly
                </label>
                <textarea
                  rows={8}
                  value={pastedText}
                  onChange={(e) => {
                    setPastedText(e.target.value);
                    if (e.target.value.trim()) setFile(null);
                  }}
                  placeholder="Paste document content here…"
                  className="w-full resize-y rounded-[16px] border border-gray-200 bg-[#F4F2FA]/50 p-5 text-[14px] leading-relaxed text-[#1E1E1E] outline-none transition-all focus:border-[#7B61FF] focus:bg-white focus:ring-2 focus:ring-[#7B61FF]/20"
                />
              </div>

              {/* Status Messages */}
              {status && (
                <div className="rounded-[12px] bg-green-50 p-5">
                  <div className="flex items-center gap-3 text-[14px] font-medium text-green-700">
                    <CheckCircle2 size={20} />
                    {status.message}
                  </div>
                  <div className="mt-2 ml-8 text-[13px] text-green-600">
                    Chunks inserted:{" "}
                    <span className="font-bold">{status.chunksInserted}</span>{" "}
                    / {status.totalChunks}
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-3 rounded-[12px] bg-red-50 p-4 text-[14px] text-red-600">
                  <AlertCircle size={20} />
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-4 pt-4">
                <Link
                  href="/dashboard"
                  className="rounded-full px-6 py-3 text-[14px] font-medium text-[#6B6B6B] transition-colors hover:bg-gray-100 hover:text-[#1E1E1E]"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={!hasInput || uploading}
                  className="flex items-center gap-2 rounded-full bg-[#7B61FF] px-8 py-3 text-[14px] font-semibold text-white shadow-[0_10px_20px_rgba(123,97,255,0.3)] transition-all duration-200 hover:scale-[1.02] hover:bg-[#5F2C82] disabled:scale-100 disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Embedding & Storing…
                    </>
                  ) : (
                    <>
                      <UploadCloud size={18} />
                      Upload & Embed
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
