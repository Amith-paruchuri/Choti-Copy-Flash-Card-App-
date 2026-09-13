/**
 * Provider-agnostic AI contract. Swap providers by adding a file that
 * implements `AIProvider` and pointing `AI_PROVIDER` at it — nothing else
 * in the app imports a provider directly; everything goes through
 * `getAIProvider()` in ./index.ts.
 */

export interface CondenseInput {
  text: string;
  subjectName?: string;
}

export interface CondenseResult {
  draft: string;
}

export interface MnemonicInput {
  title: string;
  subtitle: string;
  content: string;
  /** A prior mnemonic to steer away from when the learner asks for another. */
  avoid?: string;
}

export interface MnemonicResult {
  mnemonic: string;
}

export interface DescribeImageInput {
  /** The image to describe, as a base64 `data:` URL. */
  dataUrl: string;
  /** The card's header / typed text, to focus the description. */
  cardContext?: string;
}

export interface DescribeImageResult {
  /** Keyword-dense description, or "" when the image has no study content. */
  description: string;
}

/** One AI-drafted flashcard. `title` + `subtitle` become the display header. */
export interface GeneratedCard {
  title: string;
  subtitle: string;
  content: string;
  /**
   * Suggested placement. `subject` is the leaf name (an existing subject's
   * name verbatim when one fits, otherwise a proposed new name). `path` is
   * broad→specific and ends with `subject`; only the leaf is used today, the
   * full path is kept for the future hierarchy UI.
   */
  subject: string;
  path: string[];
}

/** A piece of source material to turn into cards. */
export type ContentPart =
  | { kind: "text"; text: string }
  | { kind: "image"; dataUrl: string };

export interface GenerateCardsInput {
  parts: ContentPart[];
  /** Free-text hint about the material, e.g. "WhatsApp chat about org chem". */
  context?: string;
  /** Hard ceiling on how many cards to return for this call. */
  maxCards: number;
  /** The user's existing subject names, so the AI can reuse one when it fits. */
  existingSubjects?: string[];
}

/** Find related-concept links for one card among a candidate set. */
export interface RelatedInput {
  card: { id: string; title: string; content: string };
  /** Other cards to consider linking to — id + short label only. */
  candidates: { id: string; title: string; subtitle: string }[];
}

export interface RelatedLink {
  /** id of a candidate card that's genuinely related. */
  relatedId: string;
  /** short relationship label, e.g. "contrast with", "mechanism", "same triad". */
  relation: string;
}

/** Input for re-sorting: existing cards that need a home in the hierarchy. */
export interface PathSuggestionInput {
  cards: { id: string; title: string; content: string }[];
  /** Existing subject paths (e.g. "Nephrology › Renal tubulopathies") to reuse. */
  existingPaths?: string[];
}

/** The AI's proposed placement for one existing card. */
export interface PathSuggestion {
  id: string;
  path: string[];
}

/** One flashcard to build a quiz question from. */
export interface QuizCardInput {
  id: string;
  title: string;
  subtitle: string;
  content: string;
  /**
   * Base64 `data:` URLs for a card whose content is mostly/only an image
   * (a pathway diagram). When present, the model is told to write the question
   * from what the image shows.
   */
  images?: string[];
}

export interface GenerateQuizInput {
  cards: QuizCardInput[];
  /**
   * Question stems to steer away from — used when a learner asks for a
   * different take on a card they found confusing or low-quality.
   */
  avoid?: string[];
  /**
   * "plain" (default) = direct recall. "vignette" = wrap the tested fact in a
   * short clinical patient scenario, board-exam style.
   */
  style?: "plain" | "vignette";
}

/**
 * One AI-written quiz question. Both formats grade the same way — the learner
 * picks one of `options` and it must equal `answer`.
 *   mcq   → `question` is a stem, options are 4 answers
 *   blank → `question` is a sentence with "____", options are a 4-word bank
 */
export interface GeneratedQuizItem {
  flashcardId: string;
  format: "mcq" | "blank";
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface AIProvider {
  /** Tighten pasted text into a clean flashcard draft. */
  condense(input: CondenseInput): Promise<CondenseResult>;
  /** Invent a memory device (acronym, phrase, image) for one card's key fact. */
  generateMnemonic(input: MnemonicInput): Promise<MnemonicResult>;
  /** Describe an uploaded image in keyword-dense text, for search + quizzes. */
  describeImage(input: DescribeImageInput): Promise<DescribeImageResult>;
  /** Read/OCR the material and draft up to `maxCards` flashcards. */
  generateCards(input: GenerateCardsInput): Promise<GeneratedCard[]>;
  /** Suggest a broad→specific path for each existing card (the "Re-sort" flow). */
  suggestPaths(input: PathSuggestionInput): Promise<PathSuggestion[]>;
  /** Pick which candidate cards are genuinely related to a given card. */
  findRelated(input: RelatedInput): Promise<RelatedLink[]>;
  /** Write one quiz question per card, varying MCQ vs fill-in-the-blank. */
  generateQuiz(input: GenerateQuizInput): Promise<GeneratedQuizItem[]>;
}
