"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { getAIProvider } from "@/lib/ai";
import { expandSubjectScope } from "@/lib/queries/quiz";
import { listFlashcards } from "@/lib/queries/flashcards";
import { IMAGE_PRIMARY_MAX_CHARS } from "@/lib/media/constants";
import { isImagePrimary } from "@/lib/media/images";
import { loadImageDataUrls } from "@/lib/media/server";
import {
  loadMemoryMap,
  loadSuspendedIds,
  studyPriority,
} from "@/lib/queries/review";
import { saveQuizSessionSchema } from "@/lib/validation";
import { recordAiCall } from "@/lib/usage/ai";
import { actionError, type ActionResult } from "@/actions/types";
import type { QuizCardInput } from "@/lib/ai/types";
import type { CardMemory } from "@/lib/srs/fsrs";
import type {
  FlashcardImage,
  QuizFormat,
  QuizQuestion,
  QuizStyle,
} from "@/types/database";

/** Images per image-primary card we send to the model (token budget). */
const IMAGES_PER_CARD = 2;

type GenCard = {
  id: string;
  title: string | null;
  subtitle: string | null;
  content: string;
  images: FlashcardImage[] | null;
};

const toQuizCardInput = (c: GenCard): QuizCardInput => ({
  id: c.id,
  title: c.title ?? "",
  subtitle: c.subtitle ?? "",
  content: c.content,
});

/** Cards per AI request. */
const BATCH = 10;
/** Most cards we'll generate questions for in one go (keeps it inside the timeout). */
const MAX_GENERATE = 20;

const cardsSchema = z.object({
  cardIds: z.array(z.string().uuid()).min(1).max(200),
  style: z.enum(["plain", "vignette"]).default("plain"),
});

const subjectSchema = z.object({
  subjectId: z.string().uuid(),
  style: z.enum(["plain", "vignette"]).default("plain"),
});

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type Supa = Awaited<ReturnType<typeof requireUser>>["supabase"];

/** Whether migration 0018 (quiz_questions.style) has been applied. */
async function quizStyleSupported(supabase: Supa): Promise<boolean> {
  const { error } = await supabase
    .from("quiz_questions")
    .select("style")
    .limit(1);
  return !error;
}

export interface QuizGenResult {
  /** Cards that now have a question. */
  total: number;
  generated: number;
  reused: number;
  /** Cards left without a question because of the per-run cap. */
  remaining: number;
}

/**
 * Ensure the given flashcards have a quiz question, generating only the ones
 * that don't (reuse forever). No FSRS side effects — that happens when the
 * question is answered.
 */
export async function generateQuizForCards(
  input: z.input<typeof cardsSchema>,
): Promise<ActionResult<QuizGenResult>> {
  const parsed = cardsSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  try {
    const { user, supabase } = await requireUser();

    const { data: cards } = await supabase
      .from("flashcards")
      .select("id, title, subtitle, content, images")
      .in("id", parsed.data.cardIds)
      .eq("is_active", true);
    if (!cards?.length) {
      return actionError("Those cards no longer exist.");
    }

    // Vignette style needs migration 0018 — fall back to plain if it's not there.
    const styleOk = await quizStyleSupported(supabase);
    const style: QuizStyle = styleOk ? parsed.data.style : "plain";

    // A card is "covered" only if it has a question in the wanted style.
    const { data: existing } = styleOk
      ? await supabase
          .from("quiz_questions")
          .select("flashcard_id, style")
          .in("flashcard_id", cards.map((c) => c.id))
      : await supabase
          .from("quiz_questions")
          .select("flashcard_id")
          .in("flashcard_id", cards.map((c) => c.id));
    const covered = new Set(
      (existing ?? [])
        .filter(
          (q) => !styleOk || ((q as { style?: string }).style ?? "plain") === style,
        )
        .map((q) => q.flashcard_id),
    );

    const needing = cards.filter((c) => !covered.has(c.id));
    const toGenerate = needing.slice(0, MAX_GENERATE);
    const remaining = needing.length - toGenerate.length;

    let generated = 0;
    if (toGenerate.length > 0) {
      const ai = getAIProvider();

      // Text-only cards batch normally; image-primary cards (a diagram with
      // little text) go one per request, with the image attached, so the model
      // has something to build a question from.
      const imagePrimary = (c: GenCard) =>
        isImagePrimary(c.content, c.images, IMAGE_PRIMARY_MAX_CHARS);
      const textCards = toGenerate.filter((c) => !imagePrimary(c));
      const imageCards = toGenerate.filter(imagePrimary);

      const batches: QuizCardInput[][] = chunk(textCards, BATCH).map((g) =>
        g.map(toQuizCardInput),
      );
      for (const c of imageCards) {
        const urls = await loadImageDataUrls(supabase, c.images, IMAGES_PER_CARD);
        batches.push([
          { ...toQuizCardInput(c), ...(urls.length > 0 && { images: urls }) },
        ]);
      }

      for (const group of batches) {
        if (group.length === 0) continue;
        const items = await ai.generateQuiz({ cards: group, style });
        await recordAiCall(supabase);

        const rows = items
          .filter((it) => group.some((c) => c.id === it.flashcardId))
          .map((it) => ({
            user_id: user.id,
            flashcard_id: it.flashcardId,
            question_text: it.question,
            options: it.options,
            correct_answer: it.answer,
            explanation: it.explanation,
            format: it.format,
            ...(styleOk && { style }),
          }));

        if (rows.length > 0) {
          const { error } = await supabase.from("quiz_questions").insert(rows);
          if (error) return actionError(error.message);
          generated += rows.length;
        }
      }
    }

    revalidatePath("/quiz");
    return {
      ok: true,
      data: {
        total: covered.size + generated,
        generated,
        reused: covered.size,
        remaining,
      },
    };
  } catch (e) {
    return actionError(
      e instanceof Error ? e.message : "Couldn’t build the quiz.",
    );
  }
}

/** Generate/reuse questions for every active card directly in a subject. */
export async function generateQuizForSubject(
  input: z.input<typeof subjectSchema>,
): Promise<ActionResult<QuizGenResult>> {
  const parsed = subjectSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  try {
    const { supabase } = await requireUser();
    const { data: cards } = await supabase
      .from("flashcards")
      .select("id")
      .eq("subject_id", parsed.data.subjectId)
      .eq("is_active", true);
    if (!cards?.length) {
      return actionError("This subject has no cards to quiz.");
    }
    return generateQuizForCards({
      cardIds: cards.map((c) => c.id),
      style: parsed.data.style,
    });
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Couldn’t build the quiz.");
  }
}

// ── Regenerate one question ──────────────────────────────────────────────

const regenerateSchema = z.object({ questionId: z.string().uuid() });

export interface RegeneratedQuestion {
  id: string;
  format: QuizFormat;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

/**
 * Replace a quiz question with a fresh AI take on the same card — for when a
 * learner finds the current one confusing or low-quality. Updates the row in
 * place so the card's review history stays attached.
 */
export async function regenerateQuizQuestion(
  input: z.input<typeof regenerateSchema>,
): Promise<ActionResult<RegeneratedQuestion>> {
  const parsed = regenerateSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  try {
    const { supabase } = await requireUser();
    const styleOk = await quizStyleSupported(supabase);

    // RLS scopes this to the caller's own questions.
    const { data: question } = styleOk
      ? await supabase
          .from("quiz_questions")
          .select("id, flashcard_id, question_text, style")
          .eq("id", parsed.data.questionId)
          .maybeSingle()
      : await supabase
          .from("quiz_questions")
          .select("id, flashcard_id, question_text")
          .eq("id", parsed.data.questionId)
          .maybeSingle();
    if (!question) return actionError("That question no longer exists.");
    const style: QuizStyle =
      styleOk && "style" in question
        ? (question.style as QuizStyle)
        : "plain";

    const { data: card } = await supabase
      .from("flashcards")
      .select("id, title, subtitle, content, images")
      .eq("id", question.flashcard_id)
      .eq("is_active", true)
      .maybeSingle();
    if (!card) return actionError("The card behind this question is gone.");

    const ai = getAIProvider();
    const images = isImagePrimary(
      card.content,
      card.images,
      IMAGE_PRIMARY_MAX_CHARS,
    )
      ? await loadImageDataUrls(supabase, card.images, IMAGES_PER_CARD)
      : [];
    const [item] = await ai.generateQuiz({
      cards: [
        {
          ...toQuizCardInput(card),
          ...(images.length > 0 && { images }),
        },
      ],
      avoid: [question.question_text],
      style,
    });
    await recordAiCall(supabase);
    if (!item) return actionError("Couldn’t come up with another question.");

    const { data: updated, error } = await supabase
      .from("quiz_questions")
      .update({
        question_text: item.question,
        options: item.options,
        correct_answer: item.answer,
        explanation: item.explanation,
        format: item.format,
      })
      .eq("id", question.id)
      .select("id, question_text, options, correct_answer, explanation, format")
      .single();
    if (error || !updated) {
      return actionError(error?.message ?? "Couldn’t save the new question.");
    }

    revalidatePath("/quiz");
    return {
      ok: true,
      data: {
        id: updated.id,
        format: updated.format,
        questionText: updated.question_text,
        options: updated.options,
        correctAnswer: updated.correct_answer,
        explanation: updated.explanation,
      },
    };
  } catch (e) {
    return actionError(
      e instanceof Error ? e.message : "Couldn’t regenerate the question.",
    );
  }
}

// ── Quiz session ─────────────────────────────────────────────────────────

const prepareSchema = z.object({
  /** Subjects to draw from (subtrees included). Empty = every subject. */
  subjectIds: z.array(z.string().uuid()).max(100).default([]),
  count: z.number().int().min(1).max(50),
  style: z.enum(["plain", "vignette"]).default("plain"),
});

export interface QuizSessionItem {
  question: {
    id: string;
    format: QuizFormat;
    questionText: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  };
  card: {
    id: string;
    title: string | null;
    subtitle: string | null;
    subjectId: string;
    subjectName: string | null;
    subjectColor: string | null;
    /** FSRS state — powers the "Why this card?" note (practice mode). */
    memory: CardMemory | null;
  };
}

export interface PreparedQuiz {
  items: QuizSessionItem[];
  /** Cards that had to be skipped because a question couldn't be made. */
  skipped: number;
}

/**
 * Build a quiz: pick `count` cards from the chosen subject subtrees (weighted
 * toward shaky / previously-missed cards), make sure each has a question,
 * and return the shuffled set to run through the client.
 */
export async function prepareQuiz(
  input: z.input<typeof prepareSchema>,
): Promise<ActionResult<PreparedQuiz>> {
  const parsed = prepareSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  try {
    await requireUser();
    const now = new Date();
    const [scope, allCards, memoryMap, suspended] = await Promise.all([
      expandSubjectScope(parsed.data.subjectIds),
      listFlashcards(),
      loadMemoryMap(),
      loadSuspendedIds(),
    ]);

    const pool = allCards.filter(
      (c) => scope.has(c.subject_id) && !suspended.has(c.id),
    );
    if (pool.length === 0) {
      return actionError("No cards in the selected subjects yet.");
    }

    // Weighted pick: struggling / due / never-seen first, with a little jitter.
    const ranked = [...pool].sort(
      (a, b) =>
        studyPriority(memoryMap.get(b.id) ?? null, now) +
        Math.random() * 0.5 -
        (studyPriority(memoryMap.get(a.id) ?? null, now) + Math.random() * 0.5),
    );
    const chosen = ranked.slice(0, parsed.data.count);
    const chosenIds = chosen.map((c) => c.id);

    // Fill any gaps in question coverage — matching the requested style.
    const { supabase } = await requireUser();
    const style = parsed.data.style;
    const matchesStyle = (q: { style?: string | null }) =>
      (q.style ?? "plain") === style;

    const { data: existing } = await supabase
      .from("quiz_questions")
      .select("*")
      .in("flashcard_id", chosenIds)
      .order("created_at", { ascending: true });

    const questionByCard = new Map<string, QuizQuestion>();
    for (const q of existing ?? []) {
      if (matchesStyle(q) && !questionByCard.has(q.flashcard_id)) {
        questionByCard.set(q.flashcard_id, q);
      }
    }

    const missing = chosenIds.filter((id) => !questionByCard.has(id));
    if (missing.length > 0) {
      const gen = await generateQuizForCards({ cardIds: missing, style });
      if (!gen.ok) return actionError(gen.error);
      const { data: fresh } = await supabase
        .from("quiz_questions")
        .select("*")
        .in("flashcard_id", missing)
        .order("created_at", { ascending: true });
      for (const q of fresh ?? []) {
        if (matchesStyle(q) && !questionByCard.has(q.flashcard_id)) {
          questionByCard.set(q.flashcard_id, q);
        }
      }
    }

    const items: QuizSessionItem[] = [];
    for (const card of chosen) {
      const q = questionByCard.get(card.id);
      if (!q) continue;
      items.push({
        question: {
          id: q.id,
          format: q.format,
          questionText: q.question_text,
          options: q.options,
          correctAnswer: q.correct_answer,
          explanation: q.explanation,
        },
        card: {
          id: card.id,
          title: card.title,
          subtitle: card.subtitle,
          subjectId: card.subject_id,
          subjectName: card.subject?.name ?? null,
          subjectColor: card.subject?.color ?? null,
          memory: memoryMap.get(card.id) ?? null,
        },
      });
    }

    if (items.length === 0) {
      return actionError("Couldn’t build any questions for those cards.");
    }

    // Shuffle so the order isn't priority-ranked.
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    return { ok: true, data: { items, skipped: chosen.length - items.length } };
  } catch (e) {
    return actionError(
      e instanceof Error ? e.message : "Couldn’t build the quiz.",
    );
  }
}

// ── Test history: persist a finished session ─────────────────────────────

/**
 * Write one `quiz_sessions` row for a completed practice quiz or timed exam.
 * The FSRS side effects already happened per-answer via `recordReview`; this
 * is purely the reviewable history record. Called once, at the done screen.
 */
export async function saveQuizSession(
  input: z.input<typeof saveQuizSessionSchema>,
): Promise<ActionResult<{ id: string | null }>> {
  const parsed = saveQuizSessionSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const d = parsed.data;

  try {
    const { user, supabase } = await requireUser();
    const answered = d.items.filter((i) => i.picked !== null).length;
    const correct = d.items.filter((i) => i.correct).length;

    const { data, error } = await supabase
      .from("quiz_sessions")
      .insert({
        user_id: user.id,
        mode: d.mode,
        subject_ids: d.subjectIds,
        scope_label: d.scopeLabel,
        total: d.items.length,
        correct,
        answered,
        time_limit_s: d.timeLimitS,
        limit_kind: d.limitKind,
        duration_s: d.durationS,
        items: d.items,
      })
      .select("id")
      .single();
    if (error || !data) {
      // Table missing (migration 0015 not applied) — the quiz still counted for
      // FSRS; history is just unavailable. Don't nag the learner.
      if (error && /quiz_sessions|does not exist|schema cache/i.test(error.message)) {
        return { ok: true, data: { id: null } };
      }
      return actionError(error?.message ?? "Couldn’t save the session.");
    }

    revalidatePath("/quiz");
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return actionError(
      e instanceof Error ? e.message : "Couldn’t save the session.",
    );
  }
}
