import { NextResponse } from "next/server";
import { getUserFromRequest, isAdminRole } from "@/lib/authServer";
import { chunkText } from "@/lib/chunkText";
import { generateEmbedding, toVectorLiteral } from "@/lib/embed";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";

// Dynamically import pdf-parse only when needed (keeps edge compat for other routes)
async function extractPdfText(buffer) {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return (data.text || "").replace(/\s+/g, " ").trim();
}

export async function POST(request) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const user = await getUserFromRequest(request);

    if (!user || !isAdminRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Parse multipart body ──────────────────────────────────────────────
    const formData = await request.formData();
    const file = formData.get("file"); // File | null
    const pastedText = formData.get("text"); // string | null

    let rawText = "";

    if (file && typeof file.arrayBuffer === "function" && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const name = (file.name || "").toLowerCase();

      if (name.endsWith(".pdf")) {
        rawText = await extractPdfText(buffer);
      } else if (name.endsWith(".txt")) {
        rawText = buffer.toString("utf-8");
      } else {
        return NextResponse.json(
          { error: "Unsupported file type. Upload a .pdf or .txt file." },
          { status: 400 }
        );
      }
    } else if (typeof pastedText === "string" && pastedText.trim().length > 0) {
      rawText = pastedText.trim();
    } else {
      return NextResponse.json(
        { error: "Provide a file (.pdf or .txt) or paste text content." },
        { status: 400 }
      );
    }

    if (!rawText) {
      return NextResponse.json(
        { error: "No readable text found in the input." },
        { status: 400 }
      );
    }

    // ── Chunk ─────────────────────────────────────────────────────────────
    const chunks = chunkText(rawText);

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "Text produced zero usable chunks." },
        { status: 400 }
      );
    }

    // ── Embed + Insert (sequential for safety) ───────────────────────────
    const supabase = getSupabaseClient();
    let inserted = 0;
    const errors = [];

    for (let i = 0; i < chunks.length; i++) {
      try {
        const embedding = await generateEmbedding(chunks[i]);

        const { error } = await supabase.from("documents").insert({
          content: chunks[i],
          embedding: toVectorLiteral(embedding),
        });

        if (error) {
          throw new Error(error.message);
        }

        inserted++;
      } catch (err) {
        console.error(`[upload-document] chunk ${i} failed:`, err.message);
        errors.push({ chunk: i, message: err.message });
      }
    }

    if (inserted === 0) {
      return NextResponse.json(
        {
          error: "All chunks failed to embed/insert.",
          details: errors,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      chunksInserted: inserted,
      totalChunks: chunks.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Upload failed" },
      { status: 500 }
    );
  }
}
