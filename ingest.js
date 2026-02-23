require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const { createClient } = require("@supabase/supabase-js");

// ── Config ───────────────────────────────────────────────────────────────────

const HF_API_URL =
  "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2";
const CHUNK_MIN_WORDS = 500;
const CHUNK_MAX_WORDS = 700;

// ── Supabase client ──────────────────────────────────────────────────────────

function getSupabase() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// ── Text extraction ──────────────────────────────────────────────────────────

async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === ".txt") {
    return fs.readFileSync(filePath, "utf-8");
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

// ── Chunking ─────────────────────────────────────────────────────────────────

function chunkText(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ");
  const chunks = [];
  let start = 0;

  while (start < words.length) {
    let end = Math.min(start + CHUNK_MAX_WORDS, words.length);
    const chunk = words.slice(start, end).join(" ");
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    start = end;
  }

  return chunks.filter((c) => c.split(" ").length >= 5);
}

// ── Embedding ────────────────────────────────────────────────────────────────

async function embed(textChunk) {
  const res = await fetch(HF_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: textChunk }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HF API ${res.status}: ${body}`);
  }

  let json = await res.json();

  // Flatten nested arrays → flat 384-dim vector
  while (Array.isArray(json) && Array.isArray(json[0])) {
    json = json[0];
  }

  if (!Array.isArray(json) || json.length !== 384) {
    throw new Error(
      `Unexpected embedding shape: ${Array.isArray(json) ? json.length : typeof json}`
    );
  }

  return json;
}

// ── Insert into Supabase ─────────────────────────────────────────────────────

async function insertRow(supabase, content, embedding) {
  const { error } = await supabase
    .from("documents")
    .insert({ content, embedding });

  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }
}

// ── Process a single file ────────────────────────────────────────────────────

async function processFile(supabase, filePath) {
  console.log(`\n📄  Processing: ${filePath}`);

  const text = await extractText(filePath);
  const chunks = chunkText(text);
  console.log(`   Chunks: ${chunks.length}`);

  for (let i = 0; i < chunks.length; i++) {
    try {
      console.log(`   ⏳  Embedding chunk ${i + 1}/${chunks.length} …`);
      const vector = await embed(chunks[i]);

      console.log(`   💾  Inserting chunk ${i + 1}/${chunks.length} …`);
      await insertRow(supabase, chunks[i], vector);

      console.log(`   ✅  Chunk ${i + 1} done.`);
    } catch (err) {
      console.error(
        `   ❌  FAILED file="${filePath}" chunk=${i + 1}: ${err.message}`
      );
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const files = process.argv.slice(2);

  if (files.length === 0) {
    console.error("Usage: node ingest.js <file1.pdf|txt> [file2.pdf|txt] …");
    process.exit(1);
  }

  if (!process.env.HUGGINGFACE_API_KEY) {
    console.error("Missing HUGGINGFACE_API_KEY env variable.");
    process.exit(1);
  }

  const supabase = getSupabase();

  for (const file of files) {
    const resolved = path.resolve(file);

    if (!fs.existsSync(resolved)) {
      console.error(`File not found: ${resolved}`);
      continue;
    }

    await processFile(supabase, resolved);
  }

  console.log("\n🎉  Ingestion complete.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
