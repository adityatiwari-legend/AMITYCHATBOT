import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authServer";
import { generateEmbedding } from "@/lib/rag";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const embedding = await generateEmbedding(text);

    return NextResponse.json({ embedding });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Embedding failed" },
      { status: 500 }
    );
  }
}
