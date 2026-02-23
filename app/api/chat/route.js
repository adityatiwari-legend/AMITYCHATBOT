import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getUserFromRequest } from "@/lib/authServer";
import { getAdminDb } from "@/lib/firebaseAdmin";
import {
  FALLBACK_ANSWER,
  buildContext,
  generateChatCompletion,
  generateEmbedding,
  searchSimilarChunks,
} from "@/lib/rag";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { question, conversationId } = await request.json();

    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    const db = getAdminDb();
    const userRef = db.collection("users").doc(user.uid);

    // Resolve or create conversation
    let convId = conversationId;

    if (!convId) {
      const convRef = await userRef.collection("conversations").add({
        title: question.length > 50 ? question.slice(0, 50) + "…" : question,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      convId = convRef.id;
    } else {
      await userRef.collection("conversations").doc(convId).update({
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    let answer = FALLBACK_ANSWER;
    let chunks = [];

    try {
      const embedding = await generateEmbedding(question);
      chunks = await searchSimilarChunks(embedding, 3);

      if (chunks.length > 0) {
        const context = buildContext(chunks);
        answer = await generateChatCompletion(question, context);
      }
    } catch (error) {
      return NextResponse.json(
        { error: error.message || "Failed to process chat" },
        { status: 500 }
      );
    }

    const messagesRef = userRef
      .collection("conversations")
      .doc(convId)
      .collection("messages");

    await messagesRef.add({
      role: "user",
      content: question,
      createdAt: FieldValue.serverTimestamp(),
    });

    await messagesRef.add({
      role: "assistant",
      content: answer,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      answer,
      conversationId: convId,
      sources: chunks.map((chunk) => chunk.content),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Chat failed" },
      { status: 500 }
    );
  }
}
