/**
 * Subject tile colours. New subjects pick from {@link SUBJECT_COLORS}; subjects
 * created under the old earthy palette get mapped to the closest new hue at
 * read time (display only — the stored value is left alone, so this is fully
 * reversible and never mutates user data).
 */

export const SUBJECT_COLORS = [
  "#3ddbb4", // mint
  "#7c6cf3", // violet
  "#5aa9ff", // sky
  "#f2647e", // rose
  "#e0a23e", // amber
  "#4fd1c5", // teal
  "#b07cf6", // lavender
  "#63c96f", // green
] as const;

export const DEFAULT_SUBJECT_COLOR = SUBJECT_COLORS[0];

/** old hex → nearest new-palette hex */
const LEGACY_MAP: Record<string, string> = {
  "#3e6b54": "#3ddbb4", // pine → mint
  "#2f6f83": "#4fd1c5", // teal → teal
  "#5a7bb0": "#5aa9ff", // dusty blue → sky
  "#8a5cc4": "#7c6cf3", // violet → violet
  "#b3538a": "#b07cf6", // magenta → lavender
  "#c06848": "#f2647e", // rust → rose
  "#c98a2c": "#e0a23e", // ochre → amber
  "#6f7d3f": "#63c96f", // olive → green
  // a few other earthy tones that appear in seeded/imported data
  "#6b2d3c": "#f2647e", // mulberry → rose
  "#b4472e": "#f2647e", // clay → rose
  "#e6b13c": "#e0a23e", // turmeric → amber
};

export function remapSubjectColor(hex: string | null | undefined): string {
  if (!hex) return DEFAULT_SUBJECT_COLOR;
  return LEGACY_MAP[hex.toLowerCase()] ?? hex;
}
