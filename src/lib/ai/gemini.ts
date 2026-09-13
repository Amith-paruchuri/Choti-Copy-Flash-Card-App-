import "server-only";

import { serverEnv } from "@/lib/env";
import {
  condenseResultSchema,
  generatedCardsSchema,
  generatedQuizEnvelopeSchema,
  generatedQuizItemSchema,
  mnemonicResultSchema,
  pathSuggestionsSchema,
  relatedLinksSchema,
} from "@/lib/validation";
import { AIError } from "@/lib/ai/errors";
import {
  CONDENSE_SYSTEM,
  DESCRIBE_IMAGE_SYSTEM,
  GENERATE_SYSTEM,
  MNEMONIC_SYSTEM,
  QUIZ_SYSTEM,
  RELATED_SYSTEM,
  SUGGEST_PATHS_SYSTEM,
  condenseUserPrompt,
  describeImageUserPrompt,
  generateUserPrompt,
  mnemonicUserPrompt,
  quizUserPrompt,
  relatedUserPrompt,
  suggestPathsUserPrompt,
} from "@/lib/ai/prompts";
import type {
  AIProvider,
  CondenseInput,
  CondenseResult,
  DescribeImageInput,
  DescribeImageResult,
  GenerateCardsInput,
  GeneratedCard,
  GenerateQuizInput,
  GeneratedQuizItem,
  MnemonicInput,
  MnemonicResult,
  PathSuggestion,
  PathSuggestionInput,
  RelatedInput,
  RelatedLink,
} from "@/lib/ai/types";

type Part =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

const REQUEST_TIMEOUT_MS = 45_000;

// Gemini's responseSchema is an OpenAPI subset — no `additionalProperties`.
const CARDS_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          subtitle: { type: "string" },
          content: { type: "string" },
          subject: { type: "string" },
          path: { type: "array", items: { type: "string" } },
        },
        required: ["title", "subtitle", "content", "subject", "path"],
        propertyOrdering: [
          "title",
          "subtitle",
          "content",
          "subject",
          "path",
        ],
      },
    },
  },
  required: ["cards"],
} as const;

const PATHS_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    assignments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          path: { type: "array", items: { type: "string" } },
        },
        required: ["id", "path"],
        propertyOrdering: ["id", "path"],
      },
    },
  },
  required: ["assignments"],
} as const;

const RELATED_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    related: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          relation: { type: "string" },
        },
        required: ["id", "relation"],
        propertyOrdering: ["id", "relation"],
      },
    },
  },
  required: ["related"],
} as const;

const QUIZ_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          format: { type: "string", enum: ["mcq", "blank"] },
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          answer: { type: "string" },
          explanation: { type: "string" },
        },
        required: [
          "id",
          "format",
          "question",
          "options",
          "answer",
          "explanation",
        ],
        propertyOrdering: [
          "id",
          "format",
          "question",
          "options",
          "answer",
          "explanation",
        ],
      },
    },
  },
  required: ["questions"],
} as const;

function dataUrlToInlineData(dataUrl: string): {
  mime_type: string;
  data: string;
} {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
  if (!match) throw new AIError("Unsupported image encoding.");
  return { mime_type: match[1], data: match[2] };
}

async function callGemini(
  systemText: string,
  userParts: Part[],
  opts: { schema?: object; retry?: boolean } = {},
): Promise<string> {
  const model = serverEnv.geminiModel;
  const generationConfig: Record<string, unknown> = {
    temperature: 0.2,
    // Room for the model's internal "thinking" tokens plus the answer.
    maxOutputTokens: 16384,
  };
  // Gemini 3.x uses thinkingLevel; keep it low to stay fast and cheap.
  if (/^gemini-3/.test(model)) {
    generationConfig.thinkingConfig = { thinkingLevel: "low" };
  }
  if (opts.schema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = opts.schema;
  }

  const body = {
    systemInstruction: { parts: [{ text: systemText }] },
    contents: [{ role: "user", parts: userParts }],
    generationConfig,
  };

  let res: Response;
  try {
    res = await fetch(
      `${serverEnv.geminiBaseUrl}/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": serverEnv.geminiApiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
  } catch (e) {
    if (opts.retry !== false) {
      return callGemini(systemText, userParts, { ...opts, retry: false });
    }
    throw new AIError("Could not reach the AI service.", e);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status >= 500 && opts.retry !== false) {
      return callGemini(systemText, userParts, { ...opts, retry: false });
    }
    throw new AIError(`AI service error (${res.status}). ${detail.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      finishReason?: string;
    }[];
    promptFeedback?: { blockReason?: string };
  };

  if (json.promptFeedback?.blockReason) {
    throw new AIError(
      `The AI declined this content (${json.promptFeedback.blockReason}).`,
    );
  }

  const candidate = json.candidates?.[0];
  const text = candidate?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new AIError(
      candidate?.finishReason
        ? `The AI stopped early (${candidate.finishReason}).`
        : "The AI service returned an empty response.",
    );
  }
  return text;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        /* fall through */
      }
    }
    throw new AIError("The AI service returned malformed JSON.");
  }
}

function parseQuizItems(raw: string): GeneratedQuizItem[] {
  const env = generatedQuizEnvelopeSchema.safeParse(parseJson(raw));
  if (!env.success) {
    throw new AIError("The AI returned a quiz in an unexpected shape.");
  }
  const items: GeneratedQuizItem[] = [];
  for (const q of env.data.questions) {
    const parsed = generatedQuizItemSchema.safeParse(q);
    if (!parsed.success) continue;
    const { id, format, question, options, answer, explanation } = parsed.data;
    items.push({ flashcardId: id, format, question, options, answer, explanation });
  }
  return items;
}

export const geminiProvider: AIProvider = {
  async condense(input: CondenseInput): Promise<CondenseResult> {
    const draft = await callGemini(CONDENSE_SYSTEM, [
      { text: condenseUserPrompt(input) },
    ]);
    const parsed = condenseResultSchema.safeParse({ draft: draft.trim() });
    if (!parsed.success) throw new AIError("The AI produced an unusable draft.");
    return parsed.data;
  },

  async generateMnemonic(input: MnemonicInput): Promise<MnemonicResult> {
    const raw = await callGemini(MNEMONIC_SYSTEM, [
      { text: mnemonicUserPrompt(input) },
    ]);
    const parsed = mnemonicResultSchema.safeParse({ mnemonic: raw.trim() });
    if (!parsed.success) {
      throw new AIError("The AI couldn’t come up with a usable mnemonic.");
    }
    return parsed.data;
  },

  async describeImage(input: DescribeImageInput): Promise<DescribeImageResult> {
    const raw = await callGemini(DESCRIBE_IMAGE_SYSTEM, [
      { text: describeImageUserPrompt(input) },
      { inline_data: dataUrlToInlineData(input.dataUrl) },
    ]);
    const text = raw.trim();
    const description =
      text.toLowerCase() === "(no description)" ? "" : text.slice(0, 2000);
    return { description };
  },

  async generateCards(input: GenerateCardsInput): Promise<GeneratedCard[]> {
    const parts: Part[] = [{ text: generateUserPrompt(input) }];
    for (const part of input.parts) {
      if (part.kind === "text") parts.push({ text: part.text });
      else parts.push({ inline_data: dataUrlToInlineData(part.dataUrl) });
    }

    const raw = await callGemini(GENERATE_SYSTEM, parts, {
      schema: CARDS_RESPONSE_SCHEMA,
    });
    const parsed = generatedCardsSchema.safeParse(parseJson(raw));
    if (!parsed.success) {
      throw new AIError("The AI returned cards in an unexpected shape.");
    }
    return parsed.data.cards.slice(0, input.maxCards);
  },

  async suggestPaths(input: PathSuggestionInput): Promise<PathSuggestion[]> {
    const raw = await callGemini(
      SUGGEST_PATHS_SYSTEM,
      [{ text: suggestPathsUserPrompt(input) }],
      { schema: PATHS_RESPONSE_SCHEMA },
    );
    const parsed = pathSuggestionsSchema.safeParse(parseJson(raw));
    if (!parsed.success) {
      throw new AIError("The AI returned placements in an unexpected shape.");
    }
    return parsed.data.assignments;
  },

  async findRelated(input: RelatedInput): Promise<RelatedLink[]> {
    const raw = await callGemini(
      RELATED_SYSTEM,
      [{ text: relatedUserPrompt(input) }],
      { schema: RELATED_RESPONSE_SCHEMA },
    );
    const parsed = relatedLinksSchema.safeParse(parseJson(raw));
    if (!parsed.success) return [];
    const valid = new Set(input.candidates.map((c) => c.id));
    return parsed.data.related
      .filter((r) => valid.has(r.id))
      .map((r) => ({ relatedId: r.id, relation: r.relation }));
  },

  async generateQuiz(input: GenerateQuizInput): Promise<GeneratedQuizItem[]> {
    const parts: Part[] = [{ text: quizUserPrompt(input) }];
    for (const c of input.cards) {
      for (const url of c.images ?? []) {
        parts.push({ text: `Image for card ${c.id}:` });
        parts.push({ inline_data: dataUrlToInlineData(url) });
      }
    }
    const raw = await callGemini(QUIZ_SYSTEM, parts, {
      schema: QUIZ_RESPONSE_SCHEMA,
    });
    return parseQuizItems(raw);
  },
};
