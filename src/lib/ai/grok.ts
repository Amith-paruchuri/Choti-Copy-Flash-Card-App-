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

type ChatMessage =
  | { role: "system" | "assistant"; content: string }
  | { role: "user"; content: string | UserContentPart[] };

type UserContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

const REQUEST_TIMEOUT_MS = 45_000;

const CARDS_JSON_SCHEMA = {
  name: "flashcards",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["cards"],
    properties: {
      cards: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "subtitle", "content", "subject", "path"],
          properties: {
            title: { type: "string" },
            subtitle: { type: "string" },
            content: { type: "string" },
            subject: { type: "string" },
            path: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  },
} as const;

const PATHS_JSON_SCHEMA = {
  name: "placements",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["assignments"],
    properties: {
      assignments: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "path"],
          properties: {
            id: { type: "string" },
            path: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  },
} as const;

const RELATED_JSON_SCHEMA = {
  name: "related",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["related"],
    properties: {
      related: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "relation"],
          properties: {
            id: { type: "string" },
            relation: { type: "string" },
          },
        },
      },
    },
  },
} as const;

const QUIZ_JSON_SCHEMA = {
  name: "quiz",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["questions"],
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "format",
            "question",
            "options",
            "answer",
            "explanation",
          ],
          properties: {
            id: { type: "string" },
            format: { type: "string", enum: ["mcq", "blank"] },
            question: { type: "string" },
            options: { type: "array", items: { type: "string" } },
            answer: { type: "string" },
            explanation: { type: "string" },
          },
        },
      },
    },
  },
} as const;

type JsonSchema =
  | typeof CARDS_JSON_SCHEMA
  | typeof PATHS_JSON_SCHEMA
  | typeof RELATED_JSON_SCHEMA
  | typeof QUIZ_JSON_SCHEMA;

async function callGrok(
  messages: ChatMessage[],
  opts: { jsonSchema?: JsonSchema; retry?: boolean } = {},
): Promise<string> {
  const body: Record<string, unknown> = {
    model: serverEnv.xaiModel,
    messages,
    temperature: 0.2,
  };
  if (opts.jsonSchema) {
    body.response_format = { type: "json_schema", json_schema: opts.jsonSchema };
  }

  let res: Response;
  try {
    res = await fetch(`${serverEnv.xaiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${serverEnv.xaiApiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    if (opts.retry !== false) return callGrok(messages, { ...opts, retry: false });
    throw new AIError("Could not reach the AI service.", e);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status >= 500 && opts.retry !== false) {
      return callGrok(messages, { ...opts, retry: false });
    }
    throw new AIError(
      `AI service error (${res.status}). ${detail.slice(0, 300)}`,
    );
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new AIError("The AI service returned an empty response.");
  return content;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // Models occasionally wrap JSON in prose or fences.
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

export const grokProvider: AIProvider = {
  async condense(input: CondenseInput): Promise<CondenseResult> {
    const draft = await callGrok([
      { role: "system", content: CONDENSE_SYSTEM },
      { role: "user", content: condenseUserPrompt(input) },
    ]);
    const parsed = condenseResultSchema.safeParse({ draft: draft.trim() });
    if (!parsed.success) {
      throw new AIError("The AI produced an unusable draft.");
    }
    return parsed.data;
  },

  async generateMnemonic(input: MnemonicInput): Promise<MnemonicResult> {
    const raw = await callGrok([
      { role: "system", content: MNEMONIC_SYSTEM },
      { role: "user", content: mnemonicUserPrompt(input) },
    ]);
    const parsed = mnemonicResultSchema.safeParse({ mnemonic: raw.trim() });
    if (!parsed.success) {
      throw new AIError("The AI couldn’t come up with a usable mnemonic.");
    }
    return parsed.data;
  },

  async describeImage(input: DescribeImageInput): Promise<DescribeImageResult> {
    const raw = await callGrok([
      { role: "system", content: DESCRIBE_IMAGE_SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: describeImageUserPrompt(input) },
          { type: "image_url", image_url: { url: input.dataUrl } },
        ],
      },
    ]);
    const text = raw.trim();
    const description =
      text.toLowerCase() === "(no description)" ? "" : text.slice(0, 2000);
    return { description };
  },

  async generateCards(input: GenerateCardsInput): Promise<GeneratedCard[]> {
    const userParts: UserContentPart[] = [
      { type: "text", text: generateUserPrompt(input) },
    ];
    for (const part of input.parts) {
      if (part.kind === "text") {
        userParts.push({ type: "text", text: part.text });
      } else {
        userParts.push({ type: "image_url", image_url: { url: part.dataUrl } });
      }
    }

    const raw = await callGrok(
      [
        { role: "system", content: GENERATE_SYSTEM },
        { role: "user", content: userParts },
      ],
      { jsonSchema: CARDS_JSON_SCHEMA },
    );

    const parsed = generatedCardsSchema.safeParse(parseJson(raw));
    if (!parsed.success) {
      throw new AIError("The AI returned cards in an unexpected shape.");
    }
    return parsed.data.cards.slice(0, input.maxCards);
  },

  async suggestPaths(input: PathSuggestionInput): Promise<PathSuggestion[]> {
    const raw = await callGrok(
      [
        { role: "system", content: SUGGEST_PATHS_SYSTEM },
        { role: "user", content: suggestPathsUserPrompt(input) },
      ],
      { jsonSchema: PATHS_JSON_SCHEMA },
    );
    const parsed = pathSuggestionsSchema.safeParse(parseJson(raw));
    if (!parsed.success) {
      throw new AIError("The AI returned placements in an unexpected shape.");
    }
    return parsed.data.assignments;
  },

  async findRelated(input: RelatedInput): Promise<RelatedLink[]> {
    const raw = await callGrok(
      [
        { role: "system", content: RELATED_SYSTEM },
        { role: "user", content: relatedUserPrompt(input) },
      ],
      { jsonSchema: RELATED_JSON_SCHEMA },
    );
    const parsed = relatedLinksSchema.safeParse(parseJson(raw));
    if (!parsed.success) return [];
    const valid = new Set(input.candidates.map((c) => c.id));
    return parsed.data.related
      .filter((r) => valid.has(r.id))
      .map((r) => ({ relatedId: r.id, relation: r.relation }));
  },

  async generateQuiz(input: GenerateQuizInput): Promise<GeneratedQuizItem[]> {
    const userParts: UserContentPart[] = [
      { type: "text", text: quizUserPrompt(input) },
    ];
    for (const c of input.cards) {
      for (const url of c.images ?? []) {
        userParts.push({ type: "text", text: `Image for card ${c.id}:` });
        userParts.push({ type: "image_url", image_url: { url } });
      }
    }
    const hasImages = input.cards.some((c) => c.images?.length);
    const raw = await callGrok(
      [
        { role: "system", content: QUIZ_SYSTEM },
        {
          role: "user",
          content: hasImages ? userParts : quizUserPrompt(input),
        },
      ],
      { jsonSchema: QUIZ_JSON_SCHEMA },
    );
    return parseQuizItems(raw);
  },
};
