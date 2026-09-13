/**
 * Anki note fields are HTML. Convert them to the plain-ish text our flashcard
 * `content` expects, and pull out `<img>` filenames so the referenced media
 * can be attached separately.
 */

export interface FieldText {
  text: string;
  /** image filenames referenced by `<img src>` (as stored in the .apkg) */
  images: string[];
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

export function fieldToText(html: string): FieldText {
  const images: string[] = [];

  let out = html
    // drop Anki sound refs entirely
    .replace(/\[sound:[^\]]*\]/g, "")
    // capture image filenames, then remove the tag
    .replace(/<img\b[^>]*?src\s*=\s*["']([^"']+)["'][^>]*>/gi, (_m, src) => {
      const name = decodeURIComponent(String(src).split("/").pop() ?? "");
      if (name) images.push(name);
      return "";
    })
    // block elements → newlines
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<hr\s*\/?>/gi, "\n———\n")
    // strip every remaining tag
    .replace(/<[^>]+>/g, "");

  out = out.replace(
    /&(nbsp|amp|lt|gt|quot|apos|#39);/g,
    (m) => ENTITIES[m] ?? m,
  );
  // numeric entities
  out = out.replace(/&#(\d+);/g, (_m, n) =>
    String.fromCodePoint(Number(n)),
  );

  out = out
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/^[\s.•·–—-]*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text: out, images: [...new Set(images)] };
}

const CLOZE_RE = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/gs;

export function isClozeText(html: string): boolean {
  return /\{\{c\d+::/.test(html);
}

/** The cloze indices present in a field, e.g. [1, 2]. */
export function clozeOrdinals(html: string): number[] {
  const set = new Set<number>();
  let m: RegExpExecArray | null;
  const re = new RegExp(CLOZE_RE);
  while ((m = re.exec(html))) set.add(Number(m[1]));
  return [...set].sort((a, b) => a - b);
}

/**
 * Render a cloze field for a given ordinal:
 *  - `revealAll` → every `{{cN::x}}` becomes `x` (the full answer sentence)
 *  - otherwise   → the target ordinal becomes `[ … ]`, the rest become `x`
 */
export function renderCloze(
  html: string,
  ordinal: number,
  revealAll: boolean,
): FieldText {
  const replaced = html.replace(
    CLOZE_RE,
    (_full, nRaw: string, answer: string, hint?: string) => {
      const n = Number(nRaw);
      if (revealAll || n !== ordinal) return answer;
      return hint ? `[ ${hint} ]` : "[ … ]";
    },
  );
  return fieldToText(replaced);
}
