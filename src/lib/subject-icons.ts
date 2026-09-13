/** Curated set of subject icon keys. Rendered by <SubjectIcon>. */
export const SUBJECT_ICON_KEYS = [
  "book",
  "dna",
  "flask",
  "atom",
  "sigma",
  "brain",
  "pulse",
  "leaf",
  "globe",
  "landmark",
  "gavel",
  "scale",
  "languages",
  "palette",
  "code",
  "music",
] as const;

export type SubjectIconKey = (typeof SUBJECT_ICON_KEYS)[number];

const RULES: [RegExp, SubjectIconKey][] = [
  [/\b(bio|cell|gene|genetic|organ|anatom|physiolog|zoolog)/, "dna"],
  [/\b(chem|reaction|acid|base|mole|organic|inorganic|bond)/, "flask"],
  [/\b(phys|force|motion|quantum|thermo|optic|mechanic|electr)/, "atom"],
  [/\b(math|calc|algebra|geometr|trig|statistic|number|arithmetic)/, "sigma"],
  [/\b(psych|cognit|behav|mind)/, "brain"],
  [/\b(med|renal|cardio|neuro|patho|pharma|clinical|disease|nephro|hepat|pulmon|respir|lung|gastro|hemato|haemato|rheum|endocrin|immuno|onco|derma)/, "pulse"],
  [/\b(eco(?!nom)|environ|botan|plant|ecolog)/, "leaf"],
  [/\b(geog|map|country|continent|climate)/, "globe"],
  [/\b(hist|war|empire|revolution|ancient|civil)/, "landmark"],
  [/\b(law|legal|constitution|court|statute|tort)/, "gavel"],
  [/\b(econ|finance|market|trade|account|business)/, "scale"],
  [/\b(lang|english|french|spanish|german|latin|grammar|vocab|literat|essay)/, "languages"],
  [/\b(art|design|paint|colou?r|draw|sculpt)/, "palette"],
  [/\b(code|program|algorithm|software|comput|data ?struct)/, "code"],
  [/\b(music|theory|harmony|instrument)/, "music"],
];

/** Best-guess icon key from a subject name. */
export function guessSubjectIcon(name: string): SubjectIconKey {
  const n = name.toLowerCase();
  for (const [re, key] of RULES) if (re.test(n)) return key;
  return "book";
}
