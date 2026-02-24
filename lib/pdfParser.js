import { PDFParse } from "pdf-parse";

export async function extractTextFromPdf(buffer) {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return (result.text || "").replace(/\s+/g, " ").trim();
  } finally {
    await parser.destroy();
  }
}

export function chunkTextByWords(text, chunkWordCount = 600) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];

  for (let index = 0; index < words.length; index += chunkWordCount) {
    chunks.push(words.slice(index, index + chunkWordCount).join(" "));
  }

  return chunks;
}
