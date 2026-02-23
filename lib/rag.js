import { getSupabaseClient } from "./supabase";
import { HfInference } from "@huggingface/inference";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const FALLBACK_ANSWER = "Information not available in university records.";

let hfClient = null;
function getHfClient() {
  if (!hfClient) {
    hfClient = new HfInference(process.env.HUGGINGFACE_API_KEY);
  }
  return hfClient;
}

function toVectorLiteral(vector) {
  return `[${vector.join(",")}]`;
}

export async function generateEmbedding(text) {
  try {
    const hf = getHfClient();
    const output = await hf.featureExtraction({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      inputs: text,
    });

    // featureExtraction returns number[] for single-sentence input
    const raw = Array.isArray(output) ? output : [];
    const vector = raw.map(Number).filter((value) => Number.isFinite(value));

    if (vector.length !== 384) {
      throw new Error(`Embedding dimension mismatch. Expected 384, got ${vector.length}.`);
    }

    return vector;
  } catch (error) {
    throw new Error(
      `Embedding generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export async function searchSimilarChunks(questionEmbedding, limit = 3) {
  const { data, error } = await getSupabaseClient().rpc("match_documents", {
    query_embedding: toVectorLiteral(questionEmbedding),
    match_count: limit,
  });

  if (error) {
    throw new Error(`Vector search failed: ${error.message}`);
  }

  return data || [];
}

export function buildContext(chunks) {
  return chunks.map((item, index) => `[${index + 1}] ${item.content}`).join("\n\n");
}

export async function generateChatCompletion(question, context) {
  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            "You are Amity University AI Assistant. Answer strictly using the provided context. If the answer is not found in the context, respond: 'Information not available in university records.' Do not guess. Do not add assumptions.",
        },
        {
          role: "user",
          content: `Context:\n${context}\n\nQuestion: ${question}`,
        },
      ],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Chat API failed: ${response.status} ${body}`);
  }

  const payload = await response.json();
  const answer = payload?.choices?.[0]?.message?.content?.trim();

  return answer || FALLBACK_ANSWER;
}

export { FALLBACK_ANSWER, toVectorLiteral };
