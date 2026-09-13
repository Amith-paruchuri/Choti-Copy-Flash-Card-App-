import { IMPORT_CAPS } from "@/lib/import/caps";

/**
 * Split text into ~chunkChars pieces on paragraph boundaries, capping the
 * total at maxInputChars. Returns `truncated: true` if the cap was hit.
 */
export function chunkText(
  raw: string,
  chunkChars: number = IMPORT_CAPS.chunkChars,
  maxChars: number = IMPORT_CAPS.maxInputChars,
): { chunks: string[]; truncated: boolean } {
  const clean = raw.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  const truncated = clean.length > maxChars;
  const capped = clean.slice(0, maxChars);

  const paragraphs = capped.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const para of paragraphs) {
    if (para.length > chunkChars) {
      flush();
      for (let i = 0; i < para.length; i += chunkChars) {
        chunks.push(para.slice(i, i + chunkChars).trim());
      }
      continue;
    }
    if (current && current.length + para.length + 2 > chunkChars) flush();
    current = current ? `${current}\n\n${para}` : para;
  }
  flush();

  return { chunks: chunks.filter(Boolean), truncated };
}
