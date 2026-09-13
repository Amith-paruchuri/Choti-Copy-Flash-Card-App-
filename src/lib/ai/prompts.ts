import type {
  CondenseInput,
  DescribeImageInput,
  GenerateCardsInput,
  GenerateQuizInput,
  MnemonicInput,
  PathSuggestionInput,
  RelatedInput,
} from "@/lib/ai/types";

/** Shared rules for building a broad→specific subject path. */
const PATH_RULES = [
  "- ALWAYS 2 to 4 elements. NEVER a single element. Even a very specific card",
  '  gets a parent: ["Nephrology","Renal tubulopathies"], not just',
  '  ["Renal tubulopathies"].',
  "- path[0] MUST be a broad field or organ system that many cards can share —",
  "  e.g. Nephrology, Pulmonology, Cardiology, Endocrinology, Neurology,",
  "  Gastroenterology, Hematology, Immunology, Rheumatology, Infectious disease,",
  "  Pharmacology, Microbiology, Biochemistry, Physiology, Pathology, Anatomy,",
  "  Genetics (or the equivalent for non-medical material). NOT a whole",
  '  discipline like "Biology" or "Medicine", and NOT a narrow topic.',
  "- The LAST element is a focused topic you would make one study deck about.",
  "- Group siblings: two cards on kidney topics should share path[0] Nephrology.",
  "- Reuse the user's existing subjects/paths (listed below) VERBATIM — segment",
  "  by segment — when a card belongs there. Prefer an existing name over a",
  '  near-duplicate you would coin ("Antiarrhythmic drugs", not "Antiarrhythmics").',
].join("\n");

export const CONDENSE_SYSTEM =
  "You rewrite a student's rough notes into ONE tight flashcard. " +
  "Keep every fact and nuance; cut filler, hedging and repetition. " +
  "Plain text, no markdown headers, no preamble. Return only the rewritten card.";

export function condenseUserPrompt({ text, subjectName }: CondenseInput): string {
  const subject = subjectName ? `Subject: ${subjectName}\n\n` : "";
  return `${subject}Rewrite this as a single concise flashcard:\n\n${text}`;
}

// ── Mnemonic ────────────────────────────────────────────────────────────────

export const MNEMONIC_SYSTEM = [
  "You invent ONE memory device for the single most test-worthy fact on a",
  "flashcard — an acronym, a short vivid phrase, a number/word association, or a",
  "quick mental image. It must genuinely aid recall, map exactly to what the card",
  "says (no invented facts), and be tight: at most 2 sentences, ideally one line.",
  "If the card is a list or a set, prefer a first-letter mnemonic and spell out",
  "what each letter stands for. No preamble, no markdown, no quotes — return only",
  "the mnemonic.",
].join("\n");

export function mnemonicUserPrompt({
  title,
  subtitle,
  content,
  avoid,
}: MnemonicInput): string {
  const header = [title, subtitle].filter(Boolean).join(" — ");
  const avoidLine = avoid
    ? `\n\nDon't reuse this earlier one — make a different device:\n${avoid}`
    : "";
  return `${header ? `${header}\n\n` : ""}${content}${avoidLine}`;
}

// ── Image description (alt text) ────────────────────────────────────────────

export const DESCRIBE_IMAGE_SYSTEM = [
  "You write a short, keyword-dense description of a study image so it can be",
  "found by text search and used to write quiz questions later.",
  "",
  "Name the diagram's subject and type (e.g. \"Krebs cycle pathway diagram\",",
  "\"coagulation cascade\", \"ECG rhythm strip\"). Then list, in reading order,",
  "every legible label: structures, molecules, enzymes, cofactors, steps,",
  "arrows and what they connect, axes, numeric values, colours that carry",
  "meaning. Use the real terms from the image, not paraphrases.",
  "",
  "1–3 sentences. Plain text, no markdown, no preamble, no \"This image shows\".",
  "If the image has no legible study content, reply with exactly: (no description)",
].join("\n");

export function describeImageUserPrompt({ cardContext }: DescribeImageInput): string {
  const ctx = cardContext?.trim();
  return ctx
    ? `The flashcard this image belongs to says:\n${ctx.slice(0, 500)}\n\nDescribe the image.`
    : "Describe this study image.";
}

export const GENERATE_SYSTEM = [
  "You turn study material into flashcards for spaced review. Each card captures",
  "ONE idea, mistake, definition or fact worth remembering.",
  "",
  "For every card return:",
  "- title: <= 8 words",
  "- subtitle: a one-line summary",
  "- content: full, self-contained, plain text",
  '- path: an array from BROAD to SPECIFIC placing this card, e.g.',
  '  ["Cardiology","Arrhythmias","Antiarrhythmic drugs"].',
  "- subject: copy the LAST element of path.",
  "",
  "Rules for path — this matters a lot:",
  PATH_RULES,
  "",
  "Make more cards for longer material, fewer for short. Skip greetings, logistics",
  "and small talk. Never invent facts. Respond only with the requested JSON.",
].join("\n");

export function generateUserPrompt({
  context,
  maxCards,
  existingSubjects,
}: Pick<
  GenerateCardsInput,
  "context" | "maxCards" | "existingSubjects"
>): string {
  const ctx = context ? `Context: ${context}\n` : "";
  const subjects = existingSubjects?.length
    ? `The user's existing subjects (reuse a string verbatim only when a card ` +
      `truly belongs at that level of detail): ${existingSubjects.join(", ")}\n`
    : "The user has no subjects yet.\n";
  return (
    `${ctx}${subjects}Create between 1 and ${maxCards} flashcards from the ` +
    `material below (text and/or images). Return JSON: ` +
    `{ "cards": [{ "title", "subtitle", "content", "subject", "path" }] }.`
  );
}

// ── Re-sort: suggest a path for existing cards ───────────────────────────────

export const SUGGEST_PATHS_SYSTEM = [
  "You file a student's existing flashcards into a subject hierarchy. For each",
  "card you are given an id and its text; return that id with a broad→specific",
  "path placing it.",
  "",
  "Rules for path — this matters a lot:",
  PATH_RULES,
  "",
  "Cards that clearly belong together MUST get the same path[0] (and, where they",
  "share a topic, the same full path) so they end up in one deck. Never invent",
  "facts, never change a card's meaning. Respond only with the requested JSON.",
].join("\n");

export function suggestPathsUserPrompt({
  cards,
  existingPaths,
}: PathSuggestionInput): string {
  const known = existingPaths?.length
    ? `Existing subject paths to reuse verbatim when a card fits:\n${existingPaths
        .map((p) => `- ${p}`)
        .join("\n")}\n\n`
    : "The user has no organised subjects yet.\n\n";
  const list = cards
    .map(
      (c) =>
        `id: ${c.id}\ntitle: ${c.title || "(untitled)"}\ncontent: ${c.content.slice(0, 600)}`,
    )
    .join("\n\n");
  return (
    `${known}Assign a path to every card below. Return JSON: ` +
    `{ "assignments": [{ "id", "path": ["broad","…","specific"] }] }.\n\n${list}`
  );
}

// ── Related concepts ────────────────────────────────────────────────────────

export const RELATED_SYSTEM = [
  "You link a study flashcard to OTHER flashcards a learner should review",
  "alongside it — a differential, a shared mechanism or pathway, a classic",
  "contrast, the same triad/syndrome, cause↔effect. Only pick genuinely useful",
  "connections; it's fine to return none. Never invent a card that isn't in the",
  "candidate list. For each, give the candidate's id and a SHORT relation label",
  "(2–4 words, lower-case, e.g. \"contrast with\", \"same pathway\", \"differential\",",
  "\"mechanism of\"). Return at most 6. Respond only with the requested JSON.",
].join("\n");

export function relatedUserPrompt({ card, candidates }: RelatedInput): string {
  const list = candidates
    .map(
      (c) =>
        `id: ${c.id}\ntitle: ${c.title || "(untitled)"}${
          c.subtitle ? `\nsummary: ${c.subtitle}` : ""
        }`,
    )
    .join("\n\n");
  return (
    `THIS CARD\ntitle: ${card.title || "(untitled)"}\ncontent: ${card.content.slice(0, 900)}\n\n` +
    `CANDIDATES\n${list}\n\n` +
    `Return JSON: { "related": [{ "id", "relation" }] } — ids from the candidate list only.`
  );
}

// ── Quiz generation ─────────────────────────────────────────────────────────

export const QUIZ_SYSTEM = [
  "You write ONE quiz question per flashcard to test active recall. Choose the",
  "format that tests each card best and VARY formats across the batch:",
  '- "mcq": a question stem with 4 options, exactly one correct.',
  '- "blank": take a real sentence from the card, replace the single most',
  '  important term with "____", and give 4 options (the true term + 3',
  "  plausible wrong terms). Keep the rest of the sentence intact.",
  "",
  "Rules — follow all of them:",
  "- EXACTLY 4 options. Exactly one is correct. `answer` must equal one option",
  "  verbatim (same case, same spelling).",
  "- Distractors must be same-category and genuinely plausible — a student who",
  "  half-remembers should hesitate. No joke options, no obviously-wrong throwaways.",
  "- The question must be answerable from the card alone. Don't test facts the",
  "  card doesn't state.",
  "- Some cards are image-primary: little or no text, with one or more images",
  "  supplied after the card list and labelled with the card id. For those, write",
  "  the question from what the image shows — a labelled structure, a step or",
  "  enzyme in a pathway, what an arrow connects. Don't phrase the stem so it",
  "  describes the very thing being asked for.",
  "- Question <= 40 words. `explanation`: 1–2 sentences on why the answer is right.",
  "- Return every card's id exactly once. Never invent facts.",
  "Respond only with the requested JSON.",
].join("\n");

export function quizUserPrompt({
  cards,
  avoid,
  style,
}: GenerateQuizInput): string {
  const list = cards
    .map(
      (c) =>
        `id: ${c.id}\ntitle: ${c.title || "(untitled)"}${
          c.subtitle ? `\nsummary: ${c.subtitle}` : ""
        }\ncontent: ${c.content.slice(0, 900) || "(none — see the image for this id below)"}${
          c.images?.length ? "\nimage-primary: yes" : ""
        }`,
    )
    .join("\n\n");
  const avoidBlock =
    avoid && avoid.length
      ? `\n\nThe learner found these earlier questions unclear or unhelpful — ` +
        `write a genuinely different one (different angle, wording, and ideally ` +
        `format):\n${avoid.map((q) => `- ${q}`).join("\n")}`
      : "";
  const vignetteBlock =
    style === "vignette"
      ? `\n\nWRITE THESE AS CLINICAL VIGNETTES. Open each "question" with a 2–3 ` +
        `sentence patient scenario — age, sex, presentation, and the relevant ` +
        `history / exam / lab findings that point to the tested concept — then ` +
        `ask. Board-exam style. The correct answer must still be fully ` +
        `determinable from the card. If a card isn't clinical, write a normal ` +
        `question for it instead — don't force a vignette. "format" still ` +
        `applies (mcq or blank) to the question part.`
      : "";
  return (
    `Write one question for every card below. Return JSON: ` +
    `{ "questions": [{ "id", "format": "mcq"|"blank", "question", ` +
    `"options": ["a","b","c","d"], "answer", "explanation" }] }.\n\n${list}` +
    avoidBlock +
    vignetteBlock
  );
}
