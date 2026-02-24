/**
 * Split text into ~500–700 word chunks.
 * Cleans whitespace and drops empty / tiny chunks.
 */
export function chunkText(text, { min = 500, max = 700 } = {}) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ").filter(Boolean);
  const chunks = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + max, words.length);
    const chunk = words.slice(start, end).join(" ");
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    start = end;
  }

  // Drop chunks with fewer than 5 words (noise)
  return chunks.filter((c) => c.split(" ").length >= 5);
}
