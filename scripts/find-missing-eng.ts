import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import path from "path";
const db = new PrismaClient();

function norm(t: string) { return t.toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N} ?]/gu, "").trim(); }

const parsed: { section: string; num: number; stem: string }[] = JSON.parse(readFileSync(path.join(process.cwd(), "scripts", "parsed-questions.json"), "utf8"));
const eng = parsed.filter((q) => q.section === "English Language");

const dbEng = await db.question.findMany({
  where: { source: "Master Competition Bank", subject: { slug: "english-language" } },
  select: { normalized: true },
});
const have = new Set(dbEng.map((q) => q.normalized));

const existing = await db.question.findMany({
  where: { subject: { slug: "english-language" }, source: { not: "Master Competition Bank" } },
  select: { normalized: true, text: true },
});

let missing = 0;
for (const q of eng) {
  const n = norm(q.stem);
  if (!have.has(n)) {
    missing++;
    console.log("MISSING Eng", q.num, "|", q.stem.slice(0, 90));
    const clash = existing.find((e) => e.normalized === n);
    if (clash) console.log("   clashes with existing bank:", clash.text.slice(0, 90));
  }
}
console.log("Missing count:", missing);
await db.$disconnect();
