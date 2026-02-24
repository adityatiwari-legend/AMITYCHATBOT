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

const VOICE_SYSTEM_PROMPT = `You are a real-time AI Voice Assistant.

PRIMARY GOAL:
Your responses will be converted into speech using a Text-to-Speech system.
Therefore, generate output optimized strictly for spoken audio.

LANGUAGE ADAPTATION RULE:
- Detect the language of the user's message.
- If user speaks Hindi, respond fully in natural Hindi.
- If user speaks English, respond fully in natural English.
- If user mixes Hindi and English, respond in natural Hinglish.
- Do not translate unless explicitly asked.

VOICE OPTIMIZATION RULES:
- Keep responses concise (maximum 3–5 short sentences).
- Use short, natural spoken sentences.
- Avoid bullet points.
- Avoid markdown formatting.
- Avoid emojis.
- Avoid long paragraphs.
- Avoid technical formatting.
- Avoid meta commentary.

SPEAKING STYLE:
- Sound like a real human assistant.
- Use conversational tone.
- Add natural pauses using commas where needed.
- Avoid robotic phrasing.

CLARITY RULE:
- If information is unknown, say: "Let me check that for you."
- Do not say you are an AI model.

INTERRUPTION FRIENDLY:
- Keep answers short so they can be interrupted easily.
- Do not repeat previous answers unless clarification is requested.

OUTPUT FORMAT:
Return plain text only.
No markdown.
No structured formatting.
The output must be directly usable for speech synthesis.

LANGUAGE ENFORCEMENT:
Follow requested output language strictly for the current turn.`;

/**
 * Classifies whether the question is related to Amity University.
 * @param {string} question
 * @returns {boolean}
 */
function isUniversityQuery(question) {
  const lower = question.toLowerCase();
  return UNIVERSITY_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function detectQuestionLanguage(question) {
  const text = question || "";
  const hasHindiScript = /[\u0900-\u097F]/.test(text);
  const hasLatinLetters = /[A-Za-z]/.test(text);
  const lower = text.toLowerCase();
  const romanHindiHints = [
    "kya",
    "hai",
    "ka",
    "ki",
    "ke",
    "sir",
    "madam",
    "nahi",
    "haan",
    "kripya",
    "please batao",
    "kab",
    "kahan",
    "kaise",
    "kitna",
  ];
  const hintHits = romanHindiHints.filter((hint) => lower.includes(hint)).length;

  if (hasHindiScript && hasLatinLetters) return "hinglish";
  if (!hasHindiScript && hasLatinLetters && hintHits >= 2) return "hinglish";
  if (hasHindiScript) return "hi";
  return "en";
}

/**
 * Returns recent conversation turns for memory.
 * @param {FirebaseFirestore.DocumentReference} userRef
 * @param {string} convId
 * @returns {Promise<Array<{ role: string, content: string }>>}
 */
async function getConversationMemory(userRef, convId) {
  if (!convId) return [];

  const snapshot = await userRef
    .collection("conversations")
    .doc(convId)
    .collection("messages")
    .orderBy("createdAt", "desc")
    .limit(8)
    .get();

  return snapshot.docs
    .map((docSnap) => docSnap.data())
    .reverse()
    .filter((row) => row?.content && row?.role)
    .map((row) => ({ role: row.role, content: String(row.content) }));
}

/**
 * Formats memory turns into a compact prompt string.
 * @param {Array<{ role: string, content: string }>} memory
 * @returns {string}
 */
function formatConversationMemory(memory) {
  if (!memory || memory.length === 0) {
    return "No previous conversation history.";
  }

  return memory
    .map((turn) => `${turn.role === "assistant" ? "Assistant" : "User"}: ${turn.content}`)
    .join("\n");
}

/**
 * Calls OpenRouter with a strict RAG prompt using retrieved context.
 * @param {string} question
 * @param {string} context
 * @param {string} memory
 * @param {"en"|"hi"|"hinglish"|undefined} voiceLanguage
 * @param {boolean} isVoice
 * @returns {Promise<string>}
 */
async function generateRAGCompletion(
  question,
  context,
  memory,
  voiceLanguage,
  isVoice = false,
) {
  const systemPrompt = isVoice ? VOICE_SYSTEM_PROMPT : `You are Amity University AI Assistant.

You must answer ONLY using the provided CONTEXT.
Do NOT use external knowledge.
Do NOT guess.
If the answer is not found in the CONTEXT, respond exactly:
"Information not available in university records."`;

  const userPrompt = `CONVERSATION HISTORY:
---------------------
${memory}
---------------------

CONTEXT:
---------------------
${context}
---------------------

QUESTION:
${question}

REQUESTED_OUTPUT_LANGUAGE:
${voiceLanguage === "hi" ? "Hindi" : voiceLanguage === "hinglish" ? "Hinglish" : "English"}

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
      temperature: isVoice ? 0.1 : 0.2,
      max_tokens: isVoice ? 120 : undefined,
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
 * @param {string} memory
 * @param {"en"|"hi"|"hinglish"|undefined} voiceLanguage
 * @param {boolean} isVoice
 * @returns {Promise<string>}
 */
async function generateGeneralCompletion(
  question,
  memory,
  voiceLanguage,
  isVoice = false,
) {
  const systemPrompt = isVoice ? VOICE_SYSTEM_PROMPT : `You are a helpful and intelligent AI assistant.
Answer clearly and concisely.`;

  const userPrompt = `Conversation History:\n${memory}\n\nRequested Output Language:\n${voiceLanguage === "hi" ? "Hindi" : voiceLanguage === "hinglish" ? "Hinglish" : "English"}\n\nUser Question:\n${question}`;

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
      temperature: isVoice ? 0.2 : 0.5,
      max_tokens: isVoice ? 120 : undefined,
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

    const { question, conversationId, isVoice, voiceLanguage } = await request.json();

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "question is required" },
        { status: 400 },
      );
    }

    const detectedLanguage = detectQuestionLanguage(question);
    const resolvedVoiceLanguage = isVoice
      ? voiceLanguage === "hi"
        ? "hi"
        : detectedLanguage
      : detectedLanguage;

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
    const memoryTurns = await getConversationMemory(userRef, convId);
    const memory = formatConversationMemory(memoryTurns);

    try {
      if (isUniversityQuery(question)) {
        // ── RAG MODE ─────────────────────────────────────────────
        mode = "rag";
        const embedding = await generateEmbedding(question);
        chunks = await searchSimilarChunks(embedding, 3);

        if (chunks.length > 0) {
          const context = buildContext(chunks);
          answer = await generateRAGCompletion(
            question,
            context,
            memory,
            resolvedVoiceLanguage,
            isVoice,
          );
        } else {
          answer = FALLBACK_ANSWER;
        }
      } else {
        // ── GENERAL MODE ──────────────────────────────────────────
        mode = "general";
        answer = await generateGeneralCompletion(
          question,
          memory,
          resolvedVoiceLanguage,
          isVoice,
        );
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
