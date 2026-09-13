export { MEDIA_BUCKET } from "@/lib/media/constants";
export const ANKI_CHUNK = 300;

/** Stable key for a deck path — used to map deck paths to resolved subject ids. */
export function deckKey(path: string[]): string {
  return JSON.stringify(path);
}
