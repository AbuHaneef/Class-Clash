// Shared type for the seed question bank.
// [gradeSlug, subjectSlug, topic, difficulty, text, options (FIRST = correct), explanation]
export type SeedQuestion = [
  string,
  string,
  string,
  "easy" | "medium" | "hard",
  string,
  string[],
  string
];
