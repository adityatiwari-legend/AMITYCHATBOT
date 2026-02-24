import { NextResponse } from "next/server";
import { getUserFromRequest, isAdminRole } from "@/lib/authServer";
import { extractTextFromPdf, chunkTextByWords } from "@/lib/pdfParser";
import { generateEmbedding, toVectorLiteral } from "@/lib/rag";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user || !isAdminRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const text = await extractTextFromPdf(fileBuffer);

    if (!text) {
      return NextResponse.json(
        { error: "No readable text found in PDF" },
        { status: 400 }
      );
    }

    const chunks = chunkTextByWords(text, 600);

    if (chunks.length === 0) {
      return NextResponse.json({ error: "No chunks generated" }, { status: 400 });
    }

    const rows = [];

    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk);
      rows.push({
        content: chunk,
        embedding: toVectorLiteral(embedding),
      });
    }

    const { error } = await getSupabaseClient().from("documents").insert(rows);

    if (error) {
      return NextResponse.json(
        { error: `Failed to store embeddings: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      chunksStored: rows.length,
    });
  } catch (error) {
    const message = error.message || "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
