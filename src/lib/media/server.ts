import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { MEDIA_BUCKET } from "@/lib/media/constants";
import type { Database, FlashcardImage } from "@/types/database";

type Client = SupabaseClient<Database>;

/** Download one stored image and return it as a base64 `data:` URL, or null. */
export async function imageDataUrl(
  supabase: Client,
  path: string,
  mime?: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).download(path);
  if (error || !data) return null;
  const b64 = Buffer.from(await data.arrayBuffer()).toString("base64");
  const type = data.type || mime || "image/jpeg";
  return `data:${type};base64,${b64}`;
}

/**
 * Resolve a card's images to data URLs for a vision model, newest first, capped.
 * Silently drops any that fail to download.
 */
export async function loadImageDataUrls(
  supabase: Client,
  images: FlashcardImage[] | null | undefined,
  max = 2,
): Promise<string[]> {
  const wanted = (images ?? []).slice(0, max);
  const urls = await Promise.all(
    wanted.map((img) => imageDataUrl(supabase, img.path, img.mime)),
  );
  return urls.filter((u): u is string => Boolean(u));
}
