import { HfInference } from "@huggingface/inference";

const MODEL = "sentence-transformers/all-MiniLM-L6-v2";

let hf = null;
function getHf() {
  if (!hf) {
    if (!process.env.HUGGINGFACE_API_KEY) {
      throw new Error("Missing HUGGINGFACE_API_KEY env variable");
    }
    hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
  }
  return hf;
}

/**
 * Generate a 384-dim embedding for a single text chunk via Hugging Face.
 */
export async function generateEmbedding(text) {
  const output = await getHf().featureExtraction({
    model: MODEL,
    inputs: text,
  });

  // Flatten nested arrays → flat 384-dim vector
  let vector = output;
  while (Array.isArray(vector) && Array.isArray(vector[0])) {
    vector = vector[0];
  }

  const nums = Array.from(vector).map(Number).filter(Number.isFinite);

  if (nums.length !== 384) {
    throw new Error(
      `Unexpected embedding dimension: expected 384, got ${nums.length}`
    );
  }

  return nums;
}

/**
 * Convert a numeric array into Supabase pgvector literal.
 */
export function toVectorLiteral(vector) {
  return `[${vector.join(",")}]`;
}
