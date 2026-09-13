/** Supabase Storage bucket holding every user-uploaded flashcard image. */
export const MEDIA_BUCKET = "flashcard-media";

/** Longest edge (px) we downscale an uploaded image to before storing it. */
export const MAX_IMAGE_EDGE = 1600;

/** Most images one flashcard can carry. */
export const MAX_CARD_IMAGES = 6;

/**
 * A card whose typed `content` is at or below this many characters counts as
 * "image-primary" — quiz generation then feeds the image to the model instead
 * of trying to write a question from a near-empty stem.
 */
export const IMAGE_PRIMARY_MAX_CHARS = 120;
