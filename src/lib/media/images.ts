import type { FlashcardImage } from "@/types/database";

/**
 * Flatten every image's `alt` description for one card into a single search
 * string. Written to `flashcards.image_alt` so account-wide search can match a
 * term that only appears inside a diagram. Returns `null` when there's nothing
 * to index (keeps the column clean rather than storing `""`).
 */
export function imageAltText(
  images: Pick<FlashcardImage, "alt">[] | null | undefined,
): string | null {
  const joined = (images ?? [])
    .map((i) => (i.alt ?? "").trim())
    .filter(Boolean)
    .join(" · ");
  return joined.length > 0 ? joined : null;
}

/** True when a card's typed content is thin enough that its image is the point. */
export function isImagePrimary(
  content: string,
  images: unknown[] | null | undefined,
  maxChars: number,
): boolean {
  return (images?.length ?? 0) > 0 && content.trim().length <= maxChars;
}
