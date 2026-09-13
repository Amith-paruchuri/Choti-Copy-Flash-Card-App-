/** Subject-tree helpers: depth cap, sibling-match normalisation. */

export const MAX_SUBJECT_DEPTH = 6;

export const PATH_SEP = " › ";

/**
 * A loose key for matching a subject name against its existing siblings, so
 * "Antiarrhythmics" resolves to an existing "Antiarrhythmic drugs"-style node
 * and "Tubulopathies" to "Tubulopathy". Only ever compared within one parent's
 * children (a small set), so occasional over-eager stemming is acceptable.
 */
export function looseKey(name: string): string {
  const w = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Words that legitimately end in "s" — leave them alone.
  if (/(?:sis|ss|us|is)$/.test(w)) return w;

  return w
    .replace(/ies$/, "y")
    .replace(/(?:ches|shes|xes|zes|ses)$/, (m) => m.slice(0, -2))
    .replace(/s$/, "");
}

/** True if two subject names should be treated as the same node. */
export function sameSubject(a: string, b: string): boolean {
  return (
    a.trim().toLowerCase() === b.trim().toLowerCase() ||
    looseKey(a) === looseKey(b)
  );
}

/** Trim, drop blanks, collapse a segment that repeats the previous, cap depth. */
export function cleanPath(segments: string[]): string[] {
  const out: string[] = [];
  for (const raw of segments) {
    const seg = raw.trim().replace(/\s+/g, " ");
    if (!seg) continue;
    if (out.length && sameSubject(out[out.length - 1], seg)) continue;
    out.push(seg);
    if (out.length >= MAX_SUBJECT_DEPTH) break;
  }
  return out;
}

/** A path array as one editable breadcrumb string, e.g. "Nephrology › Renal tubulopathies". */
export function pathText(p: string[]): string {
  return p.join(PATH_SEP);
}

/** The inverse of `pathText` — also accepts ">" or "/" as a separator, since
 * typing "›" isn't convenient on most keyboards. */
export function parsePathText(t: string): string[] {
  return cleanPath(t.split(/\s*[›>/]\s*/));
}
