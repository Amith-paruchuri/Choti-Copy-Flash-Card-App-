/**
 * Heuristic: does a flashcard's content describe a causal chain / sequence?
 * If so, return the ordered node labels; otherwise return null and the card
 * renders as plain text. Deliberately conservative — a missed chain is fine,
 * a mangled definition is not.
 */

const SEP = String.fromCharCode(1); // internal split marker; never in card text

/** Arrow glyphs and ASCII arrows — split, drop the arrow. */
const ARROWS = /\s*(?:-->|->|=>|→|⇒|➔|➜|⟶)\s*/g;

/** Connector phrases — split, drop the phrase (optionally with a leading comma). */
const DROP_PHRASES = [
  "leads to",
  "lead to",
  "leading to",
  "results in",
  "result in",
  "resulting in",
  "which results in",
  "which leads to",
  "culminating in",
  "and then",
  "then",
  "so that",
  "thereby",
  "therefore",
  "thus",
  "hence",
];

/** Present participles that start a new consequence node — kept in the label. */
const PARTICIPLES = [
  "causing",
  "mimicking",
  "producing",
  "activating",
  "inhibiting",
  "blocking",
  "triggering",
  "stimulating",
  "preventing",
  "promoting",
  "reducing",
  "increasing",
  "decreasing",
  "raising",
  "lowering",
  "impairing",
  "enhancing",
  "generating",
  "yielding",
];

/** Content that is a comparison / table / definition, not a sequence. */
const NOT_A_CHAIN =
  /\b(?:vs\.?|versus|whereas|compared (?:to|with)|on the other hand|in contrast|difference between)\b/i;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function stripNode(s: string): string {
  return s
    .trim()
    .replace(/^(?:and|then|which|this|it|that|the)\s+/i, "")
    .replace(/^[-–—•*\s]+/, "")
    .replace(/[\s,;.]+(?:this|it|which|that)\s*$/i, "") // "…11β-HSD2. This"
    .replace(/[,.;:]+$/, "")
    .trim();
}

function fromNumberedList(content: string): string[] | null {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const numbered = lines.filter((l) => /^\d+[.)]\s+/.test(l));
  if (numbered.length >= 3 && numbered.length === lines.length) {
    return numbered.map((l) => stripNode(l.replace(/^\d+[.)]\s+/, "")));
  }

  // inline "1. x 2. y 3. z"
  const inline = content.replace(/\s+/g, " ").trim();
  if ((inline.match(/(?:^|\s)\d+[.)]\s/g) ?? []).length >= 3) {
    return inline
      .split(/\s+(?=\d+[.)]\s)/)
      .map((p) => stripNode(p.replace(/^\d+[.)]\s*/, "")))
      .filter(Boolean);
  }
  return null;
}

function fromInlineChain(content: string): string[] | null {
  let s = content.replace(/\s+/g, " ").trim();

  s = s.replace(ARROWS, SEP);

  for (const phrase of DROP_PHRASES) {
    s = s.replace(
      new RegExp(`\\s*[,;]?\\s*\\b${escape(phrase)}\\b\\s+`, "gi"),
      SEP,
    );
  }

  // "…acid, which inhibits X" → node "inhibits X"
  s = s.replace(/\s*[,;]?\s*\bwhich\s+/gi, SEP);

  // "…, causing X" → node "causing X"
  s = s.replace(
    new RegExp(`\\s*,\\s*(${PARTICIPLES.join("|")})\\s+`, "gi"),
    `${SEP}$1 `,
  );

  return s.split(SEP).map(stripNode).filter(Boolean);
}

export function parseMechanism(content: string): string[] | null {
  if (!content || content.length > 1200) return null;
  if (NOT_A_CHAIN.test(content)) return null;

  const nodes = fromNumberedList(content) ?? fromInlineChain(content);
  if (!nodes || nodes.length < 3) return null;

  // Every node must read like a label, not a sentence.
  if (nodes.some((n) => n.length < 2 || n.length > 90)) return null;

  // The chain must account for most of the card — not a fragment of an essay.
  const chainLen = nodes.join(" ").length;
  const contentLen = content.replace(/\s+/g, " ").trim().length;
  if (chainLen < contentLen * 0.55) return null;

  return nodes;
}
