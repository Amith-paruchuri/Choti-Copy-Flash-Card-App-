import { z } from "zod";

import { SUBJECT_ICON_KEYS } from "@/lib/subject-icons";
import { DEFAULT_SUBJECT_COLOR } from "@/lib/subject-color";

/** Shared Zod schemas for form input and AI output. */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be at most 72 characters.");

export const credentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export type Credentials = z.infer<typeof credentialsSchema>;

/** Display name shown on the profile and derived for greetings. */
export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(80, "Keep your name under 80 characters.");

// ── Subjects ─────────────────────────────────────────────────────────────

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export { SUBJECT_COLORS, DEFAULT_SUBJECT_COLOR } from "@/lib/subject-color";

export const subjectNameSchema = z
  .string()
  .trim()
  .min(1, "Give the subject a name.")
  .max(80, "Keep the subject name under 80 characters.");

export const subjectColorSchema = z
  .string()
  .regex(HEX_COLOR, "Pick a colour.");

export const subjectIconSchema = z.enum(SUBJECT_ICON_KEYS);

export const createSubjectSchema = z.object({
  name: subjectNameSchema,
  color: subjectColorSchema.default(DEFAULT_SUBJECT_COLOR),
  icon: subjectIconSchema.optional(),
});

/** Manual "New folder" — may nest under an existing subject. */
export const createFolderSchema = z.object({
  name: subjectNameSchema,
  color: subjectColorSchema.default(DEFAULT_SUBJECT_COLOR),
  icon: subjectIconSchema,
  parentId: z.string().uuid().nullable().default(null),
});

/** Rename / restyle a folder the user owns. */
export const editSubjectSchema = z.object({
  id: z.string().uuid(),
  name: subjectNameSchema,
  color: subjectColorSchema,
  icon: subjectIconSchema,
});

/** Reparent a folder (and its whole subtree) or promote it to top level. */
export const moveSubjectSchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable().default(null),
});

/** Reparent several folders at once (dashboard multi-select). */
export const moveSubjectsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
  parentId: z.string().uuid().nullable().default(null),
});

/** Delete a folder — with cards / children, choose what happens to them. */
export const deleteSubjectSchema = z.object({
  id: z.string().uuid(),
  /** "cascade" removes everything inside; "reparent" moves contents elsewhere. */
  mode: z.enum(["cascade", "reparent"]),
  /** Where contents go when mode is "reparent"; null = top level. */
  targetId: z.string().uuid().nullable().default(null),
});

/** Move one or more flashcards into a subject (no other edits). */
export const moveFlashcardsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  subjectId: z.string().uuid(),
});

// ── Flashcards ───────────────────────────────────────────────────────────

export const flashcardContentSchema = z
  .string()
  .trim()
  .min(1, "The flashcard can't be empty.")
  .max(4000, "Keep a flashcard under 4000 characters.");

/**
 * Card body as typed into a form — may be blank when the card carries an image
 * instead (an image-primary card, e.g. a pathway diagram). The create/update
 * schemas enforce "text OR image" at the object level.
 */
export const flashcardBodySchema = z
  .string()
  .trim()
  .max(4000, "Keep a flashcard under 4000 characters.");

/** One uploaded flashcard image, as recorded by the card create/update action. */
export const flashcardImageInputSchema = z.object({
  path: z.string().min(1).max(300),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  mime: z.string().min(1).max(80),
  bytes: z.number().int().min(0).max(25_000_000).default(0),
  alt: z.string().trim().max(2000).default(""),
});

/**
 * The `images` form field: a JSON array string (hidden input) or an array.
 * Absent (`null`/`undefined`) stays `undefined` so the action can tell "leave
 * images alone" from "set images to []".
 */
export const flashcardImagesInputSchema = z.preprocess((v) => {
  if (v === null || v === undefined) return undefined;
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (!s) return [];
  try {
    return JSON.parse(s);
  } catch {
    return v;
  }
}, z.array(flashcardImageInputSchema).max(6).optional());

/**
 * A broad→specific subject path (e.g. from the AI's "Suggest subject"), as a
 * JSON array form field — same string-or-array preprocessing as `images`.
 * `resolvePath` does the actual find-or-create walk; this just shapes the
 * input.
 */
export const subjectPathInputSchema = z.preprocess((v) => {
  if (v === null || v === undefined) return undefined;
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    return v;
  }
}, z.array(z.string().trim().min(1).max(80)).min(1).max(6).optional());

/**
 * A flashcard is assigned to a subject by `subjectId` (existing),
 * `newSubjectName` (created / reused on the fly), or `path` (broad→specific,
 * each segment found-or-created — the AI-suggested route).
 */
export const createFlashcardSchema = z
  .object({
    content: flashcardBodySchema.default(""),
    title: z.string().trim().max(120).optional(),
    subtitle: z.string().trim().max(300).optional(),
    sourceType: z.enum(["typed", "pasted"]).default("typed"),
    subjectId: z.string().uuid().optional(),
    newSubjectName: subjectNameSchema.optional(),
    newSubjectColor: subjectColorSchema.optional(),
    newSubjectIcon: subjectIconSchema.optional(),
    path: subjectPathInputSchema,
    images: flashcardImagesInputSchema,
  })
  .refine(
    (d) => Boolean(d.subjectId) || Boolean(d.newSubjectName) || Boolean(d.path?.length),
    {
      message: "Choose a subject or create a new one.",
      path: ["subjectId"],
    },
  )
  .refine((d) => d.content.length > 0 || (d.images?.length ?? 0) > 0, {
    message: "Add some text or an image.",
    path: ["content"],
  });

export const cardTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(120, "Keep the title under 120 characters.");

export const cardSubtitleSchema = z
  .string()
  .trim()
  .max(300, "Keep the subtitle under 300 characters.");

/** A memory device — a line or two, from the AI or hand-edited. */
export const mnemonicSchema = z
  .string()
  .trim()
  .max(600, "Keep a mnemonic under 600 characters.");

export const updateFlashcardSchema = z
  .object({
    id: z.string().uuid(),
    content: flashcardBodySchema.default(""),
    title: z.string().trim().max(120).optional(),
    subtitle: z.string().trim().max(300).optional(),
    subjectId: z.string().uuid(),
    mnemonic: mnemonicSchema.optional(),
    images: flashcardImagesInputSchema,
  })
  .refine((d) => d.content.length > 0 || d.images === undefined || d.images.length > 0, {
    message: "Add some text or an image.",
    path: ["content"],
  });

// ── Study pacing ─────────────────────────────────────────────────────────

const optionalCount = (min: number, max: number) =>
  z.preprocess((v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (s === "") return null;
    const n = Math.round(Number(s));
    return Number.isFinite(n) ? n : null;
  }, z.number().int().min(min).max(max).nullable());

/** Account → "Study pacing". An empty daily goal means "no goal". */
export const studyPacingSchema = z.object({
  newCardsPerDay: z.preprocess(
    (v) => {
      const n = Math.round(Number(String(v ?? "").trim() || "0"));
      return Number.isFinite(n) ? n : 0;
    },
    z
      .number()
      .int("Use a whole number.")
      .min(0, "Can't be negative.")
      .max(500, "Keep it at 500 or below."),
  ),
  dailyReviewTarget: optionalCount(1, 2000),
});

// ── AI output ────────────────────────────────────────────────────────────

/**
 * Whole-discipline names that are useless as a study subject. If the model
 * hands one back as the leaf but the path has a more specific tail, we promote
 * the specific one (belt-and-suspenders behind the prompt).
 */
const BROAD_SUBJECTS = new Set([
  "biology",
  "medicine",
  "science",
  "life sciences",
  "clinical medicine",
  "general",
  "misc",
  "miscellaneous",
]);

export const isBroadSubject = (s: string) =>
  BROAD_SUBJECTS.has(s.trim().toLowerCase());
const isBroad = isBroadSubject;

/** One flashcard as drafted by the AI provider. */
export const generatedCardSchema = z
  .object({
    title: cardTitleSchema.catch("Untitled card"),
    subtitle: cardSubtitleSchema.catch(""),
    content: flashcardContentSchema,
    subject: subjectNameSchema.catch("Imported"),
    path: z
      .array(z.string().trim().min(1).max(80))
      .max(6)
      .catch([]),
  })
  .transform((c) => {
    const cleanPath = c.path.map((s) => s.trim()).filter(Boolean);
    let subject = c.subject.trim();

    // If the leaf is a whole discipline, drop down to the most specific
    // non-broad segment the path offers.
    if (isBroad(subject)) {
      const specific = [...cleanPath].reverse().find((seg) => !isBroad(seg));
      if (specific) subject = specific;
    }

    // Path always runs broad → subject, with no trailing umbrella segment.
    let path = cleanPath.length ? cleanPath : [subject];
    if (isBroad(path[path.length - 1])) path = path.slice(0, -1);
    if (path.length === 0 || path[path.length - 1] !== subject) {
      path = [...path, subject];
    }

    return { ...c, subject, path };
  });
export type GeneratedCardParsed = z.infer<typeof generatedCardSchema>;

/** Wrapper the model returns (json_schema needs a root object, not an array). */
export const generatedCardsSchema = z.object({
  cards: z.array(generatedCardSchema).max(60),
});

export const mnemonicResultSchema = z.object({
  mnemonic: z.string().trim().min(1).max(600),
});

export const condenseResultSchema = z.object({
  draft: flashcardContentSchema,
});

/** One AI placement in the re-sort flow: a card id + a broad→specific path. */
export const pathSuggestionSchema = z
  .object({
    id: z.string().min(1),
    path: z.array(z.string()).catch([]),
  })
  .transform((a) => {
    const clean = a.path
      .map((s) => (typeof s === "string" ? s.trim().slice(0, 80) : ""))
      .filter(Boolean)
      .slice(0, 6);
    const trimmed = clean.filter((s) => !isBroad(s));
    // Keep at least the leaf even if every segment reads as "broad".
    return { id: a.id, path: trimmed.length ? trimmed : clean.slice(-1) };
  });

export const pathSuggestionsSchema = z.object({
  assignments: z.array(pathSuggestionSchema).max(200),
});

/** One AI-detected relationship: a candidate card id + a short relation label. */
export const relatedLinkSchema = z.object({
  id: z.string().min(1),
  relation: z.string().trim().max(40).catch("").default(""),
});

export const relatedLinksSchema = z.object({
  related: z.array(relatedLinkSchema).max(12),
});

// ── AI quiz output ───────────────────────────────────────────────────────

const quizOptionSchema = z.string().trim().min(1).max(300);

/**
 * One AI quiz question, normalised so it always grades cleanly: 2–4 unique
 * options with the answer guaranteed to be one of them.
 */
export const generatedQuizItemSchema = z
  .object({
    id: z.string().min(1),
    format: z.enum(["mcq", "blank"]).catch("mcq"),
    question: z.string().trim().min(1).max(1000),
    options: z.array(z.string()).catch([]),
    answer: z.string().trim().min(1).max(300),
    explanation: z.string().trim().max(1000).catch(""),
  })
  .transform((q) => {
    const seen = new Set<string>();
    const options: string[] = [];
    for (const raw of q.options) {
      const parsed = quizOptionSchema.safeParse(raw);
      if (!parsed.success) continue;
      const key = parsed.data.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      options.push(parsed.data);
    }

    let answer = q.answer;
    const exact = options.find((o) => o === answer);
    const ci = options.find((o) => o.toLowerCase() === answer.toLowerCase());
    if (exact) answer = exact;
    else if (ci) answer = ci;
    else options.unshift(answer);

    return { ...q, options: options.slice(0, 4), answer };
  })
  .refine((q) => q.options.length >= 2 && q.options.includes(q.answer), {
    message: "A quiz question needs 2–4 options including the answer.",
  });

/** Envelope only — items are validated one by one so a bad one is dropped. */
export const generatedQuizEnvelopeSchema = z.object({
  questions: z.array(z.unknown()).max(80),
});

// ── Quiz sessions (test history) ─────────────────────────────────────────

const quizSessionEntrySchema = z.object({
  questionId: z.string().uuid(),
  cardId: z.string().uuid(),
  subjectId: z.string().uuid(),
  cardTitle: z.string().max(200).nullable(),
  subjectName: z.string().max(200).nullable(),
  subjectColor: z.string().max(40).nullable(),
  format: z.enum(["mcq", "blank"]),
  questionText: z.string().trim().min(1).max(4000),
  options: z.array(z.string().max(400)).min(2).max(6),
  correctAnswer: z.string().max(400),
  explanation: z.string().max(2000).default(""),
  picked: z.string().max(400).nullable(),
  correct: z.boolean(),
});

export const saveQuizSessionSchema = z.object({
  mode: z.enum(["practice", "exam"]),
  subjectIds: z.array(z.string().uuid()).max(100).default([]),
  scopeLabel: z.string().trim().min(1).max(120).default("All subjects"),
  timeLimitS: z.number().int().positive().max(24 * 3600).nullable().default(null),
  limitKind: z.enum(["overall", "per_question"]).nullable().default(null),
  durationS: z.number().int().min(0).max(24 * 3600).default(0),
  items: z.array(quizSessionEntrySchema).min(1).max(50),
});
