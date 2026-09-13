import "server-only";

import { serverEnv } from "@/lib/env";
import { grokProvider } from "@/lib/ai/grok";
import { geminiProvider } from "@/lib/ai/gemini";
import type { AIProvider } from "@/lib/ai/types";

export type { AIProvider } from "@/lib/ai/types";
export { AIError } from "@/lib/ai/errors";

const providers: Record<string, AIProvider> = {
  grok: grokProvider,
  gemini: geminiProvider,
};

/** The configured AI provider. Set `AI_PROVIDER` to switch (default: grok). */
export function getAIProvider(): AIProvider {
  const key = serverEnv.aiProvider.toLowerCase();
  const provider = providers[key];
  if (!provider) {
    throw new Error(
      `Unknown AI_PROVIDER "${key}". Available: ${Object.keys(providers).join(", ")}`,
    );
  }
  return provider;
}
