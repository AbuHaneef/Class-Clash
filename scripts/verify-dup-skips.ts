// Verify the 16 skipped-as-duplicate questions: confirm the existing DB twin
// has the same stem AND the same correct answer.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const DUPES: [number, string][] = [
  [118, "5 - 2 = ?"], [119, "6 - 3 = ?"], [129, "8 - 1 = ?"], [137, "13 - 3 = ?"],
  [393, "16 metres = how many centimetres?"], [407, "3 x 6 = ?"], [408, "10 x 10 = ?"],
  [409, "2 x 4 = ?"], [544, "4 ÷ 2 = ?"], [692, "12 metres = how many centimetres?"],
  [694, "17 metres = how many centimetres?"], [701, "8 kilograms = how many grams?"],
  [873, "Which is greater: -10 or -8?"], [877, "-12 + 3 = ?"], [886, "-4 x 2 = ?"],
  [893, "10 - 14 = ?"],
];
const DOC_KEY: Record<number, string> = {
  118: "3", 119: "3", 129: "7", 137: "10", 393: "1600", 407: "18", 408: "100", 409: "8",
  544: "2", 692: "1200", 694: "1700", 701: "8000", 873: "-8", 877: "-9", 886: "-8", 893: "-4",
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N} ?]/gu, "").trim();
}

async function main() {
  for (const [num, stem] of DUPES) {
    const found = await db.question.findUnique({ where: { normalized: normalize(stem) }, include: { options: true, grade: true } });
    if (!found) { console.log(`#${num} '${stem}' -> NOT FOUND (unexpected)`); continue; }
    const correct = found.options.find((o) => o.isCorrect)?.text ?? "??";
    const match = correct === DOC_KEY[num] ? "SAME answer ✓" : `DIFFERENT answer (db=${correct}, doc=${DOC_KEY[num]}) ⚠`;
    console.log(`#${num} '${stem}' -> exists in ${found.grade.name} [${found.source}] ${match}`);
  }
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
