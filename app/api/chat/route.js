import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getUserFromRequest } from "@/lib/authServer";
import { getAdminDb } from "@/lib/firebaseAdmin";
import {
  FALLBACK_ANSWER,
  buildContext,
  generateEmbedding,
  searchSimilarChunks,
} from "@/lib/rag";

export const runtime = "nodejs";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "deepseek/deepseek-chat";

const UNIVERSITY_KEYWORDS = [
  "amity",
  "university",
  "aset",
  "faculty",
  "room",
  "admission",
  "course",
  "btech",
  "mba",
  "hostel",
  "attendance",
  "scholarship",
  "placement",
  "exam",
  "department",
];

/**
 * Classifies whether the question is related to Amity University.
 * @param {string} question
 * @returns {boolean}
 */
function isUniversityQuery(question) {
  const lower = question.toLowerCase();
  return UNIVERSITY_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/**
 * Calls OpenRouter with a strict RAG prompt using retrieved context.
 * @param {string} question
 * @param {string} context
 * @returns {Promise<string>}
 */
async function generateRAGCompletion(question, context) {
  const systemPrompt = `You are Amity University AI Assistant.

You must answer ONLY using the provided CONTEXT.
Do NOT use external knowledge.
Do NOT guess.
If the answer is not found in the CONTEXT, respond exactly:
"Information not available in university records."`;

  const userPrompt = `CONTEXT:
---------------------
${context}
---------------------

QUESTION:
${question}

ANSWER:`;

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter RAG call failed: ${response.status} ${body}`);
  }

  const payload = await response.json();
  const answer = payload?.choices?.[0]?.message?.content?.trim();
  return answer || FALLBACK_ANSWER;
}

/**
 * Calls OpenRouter with a general helpful-assistant prompt.
 * @param {string} question
 * @returns {Promise<string>}
 */
async function generateGeneralCompletion(question) {
  const systemPrompt = `You are a helpful and intelligent AI assistant.
Answer clearly and concisely.`;

  const userPrompt = `User Question:\n${question}`;

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `OpenRouter general call failed: ${response.status} ${body}`,
    );
  }

  const payload = await response.json();
  const answer = payload?.choices?.[0]?.message?.content?.trim();
  return answer || "Sorry, I could not generate a response. Please try again.";
}

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { question, conversationId } = await request.json();

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "question is required" },
        { status: 400 },
      );
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

    let answer;
    let chunks = [];
    let mode; // "rag" | "general"

    try {
      if (isUniversityQuery(question)) {
        // ── RAG MODE ─────────────────────────────────────────────
        mode = "rag";
        const embedding = await generateEmbedding(question);
        chunks = await searchSimilarChunks(embedding, 3);

        if (chunks.length > 0) {
          const context = buildContext(chunks);
          answer = await generateRAGCompletion(question, context);
        } else {
          answer = FALLBACK_ANSWER;
        }
      } else {
        // ── GENERAL MODE ──────────────────────────────────────────
        mode = "general";
        answer = await generateGeneralCompletion(question);
      }
    } catch (error) {
      return NextResponse.json(
        { error: error.message || "Failed to process chat" },
        { status: 500 },
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
      mode,
      sources: chunks.map((chunk) => chunk.content),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Chat failed" },
      { status: 500 },
    );
  }
}
