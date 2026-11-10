// ClassClash production migration:
//  1. Delete E2E test junk questions (and their attempts)
//  2. Replace ambiguous punctuation question with the reviewed comma question
//  3. Relabel question bank source/reviewNote (Demo → Launch)
//  4. Convert demo staff accounts into real platform staff accounts (in place, preserving references)
//  5. Update welcome announcement
//  6. VERIFY: every seed question exists in DB with exactly the reviewed correct answer
import { randomBytes, scryptSync } from "crypto";
import { PrismaClient } from "@prisma/client";
import { QUESTIONS_1 } from "../prisma/seed-questions-1";
import { QUESTIONS_2 } from "../prisma/seed-questions-2";
import type { SeedQuestion } from "../prisma/seed-types";

const db = new PrismaClient();
const ALL_QUESTIONS: SeedQuestion[] = [...QUESTIONS_1, ...QUESTIONS_2];

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N} ?]/gu, "").trim();
}

async function main() {
  // ── 1. Delete E2E junk ──
  const junk = await db.question.findMany({
    where: { OR: [{ source: "ClassClash Editor" }, { source: "CSV Import" }] },
    select: { id: true, text: true },
  });
  const junkIds = junk.map((q) => q.id);
  if (junkIds.length) {
    const attempts = await db.questionAttempt.deleteMany({ where: { questionId: { in: junkIds } } });
    await db.question.deleteMany({ where: { id: { in: junkIds } } }); // options cascade
    console.log(`1. Deleted ${junk.length} E2E junk questions (+${attempts.count} orphan attempts)`);
  } else {
    console.log("1. No junk questions found");
  }

  // ── 2. Replace punctuation question ──
  const oldNorm = normalize("Which sentence is correctly punctuated?");
  const oldQ = await db.question.findUnique({ where: { normalized: oldNorm } });
  if (oldQ) {
    const newText = "Which sentence uses the comma correctly?";
    const newOptions = [
      { text: "We bought apples, oranges and mangoes.", isCorrect: true },
      { text: "We bought apples oranges, and mangoes.", isCorrect: false },
      { text: "We, bought apples oranges and mangoes.", isCorrect: false },
      { text: "We bought apples oranges and, mangoes.", isCorrect: false },
    ];
    await db.questionOption.deleteMany({ where: { questionId: oldQ.id } });
    await db.question.update({
      where: { id: oldQ.id },
      data: {
        text: newText,
        normalized: normalize(newText),
        explanation: "Commas separate items in a list: the comma goes after each item (apples, oranges), never before the list or inside it.",
      },
    });
    let order = 0;
    for (const o of newOptions) {
      order++;
      await db.questionOption.create({ data: { questionId: oldQ.id, text: o.text, isCorrect: o.isCorrect, order } });
    }
    console.log("2. Replaced ambiguous punctuation question with reviewed comma question");
  } else {
    console.log("2. Old punctuation question not found (already replaced)");
  }

  // ── 3. Relabel source/reviewNote ──
  const relabel = await db.question.updateMany({
    where: { source: "ClassClash Demo Bank" },
    data: { source: "ClassClash Launch Bank", reviewNote: "Reviewed for launch." },
  });
  console.log(`3. Relabelled ${relabel.count} questions: source=ClassClash Launch Bank`);

  // ── 4. Real staff accounts (update in place to preserve FK references) ──
  // displayName is UNIQUE, so if a fresh .com duplicate was created by an earlier
  // run, retire it first (it has no references), then rename the .demo account in place.
  const oldAdmin = await db.user.findUnique({ where: { email: "admin@classclash.demo" } });
  const comAdmin = await db.user.findUnique({ where: { email: "admin@classclash.com" } });
  if (oldAdmin) {
    if (comAdmin && comAdmin.id !== oldAdmin.id) {
      try { await db.user.delete({ where: { id: comAdmin.id } }); console.log("4a. Removed duplicate fresh admin row"); } catch { /* referenced; will rename below anyway */ }
    }
    await db.user.update({
      where: { id: oldAdmin.id },
      data: { email: "admin@classclash.com", passwordHash: hashPassword("Admin#ClassClash2026"), displayName: "Platform Admin" },
    });
    console.log("4a. Demo admin converted to admin@classclash.com (in place)");
  } else if (comAdmin) {
    await db.user.update({ where: { id: comAdmin.id }, data: { passwordHash: hashPassword("Admin#ClassClash2026"), displayName: "Platform Admin", role: "admin" } });
    console.log("4a. Admin account ready: admin@classclash.com");
  } else {
    await db.user.create({
      data: { email: "admin@classclash.com", passwordHash: hashPassword("Admin#ClassClash2026"), displayName: "Platform Admin", avatar: "owl", role: "admin", onboarded: true, gradeId: null },
    });
    console.log("4a. Admin account created: admin@classclash.com");
  }

  const oldReviewer = await db.user.findUnique({ where: { email: "reviewer@classclash.demo" } });
  const comReviewer = await db.user.findUnique({ where: { email: "reviewer@classclash.com" } });
  if (oldReviewer) {
    if (comReviewer && comReviewer.id !== oldReviewer.id) {
      try { await db.user.delete({ where: { id: comReviewer.id } }); console.log("4b. Removed duplicate fresh reviewer row"); } catch { /* referenced */ }
    }
    await db.user.update({
      where: { id: oldReviewer.id },
      data: { email: "reviewer@classclash.com", passwordHash: hashPassword("Review#ClassClash2026"), displayName: "Lead Reviewer" },
    });
    console.log("4b. Demo reviewer converted to reviewer@classclash.com (in place)");
  } else if (comReviewer) {
    await db.user.update({ where: { id: comReviewer.id }, data: { passwordHash: hashPassword("Review#ClassClash2026"), displayName: "Lead Reviewer", role: "reviewer" } });
    console.log("4b. Reviewer account ready: reviewer@classclash.com");
  } else {
    await db.user.create({
      data: { email: "reviewer@classclash.com", passwordHash: hashPassword("Review#ClassClash2026"), displayName: "Lead Reviewer", avatar: "dragon", role: "reviewer", onboarded: true },
    });
    console.log("4b. Reviewer account created: reviewer@classclash.com");
  }

  // ── 5. Announcement ──
  const ann = await db.announcement.updateMany({
    where: { body: { contains: "Demo Guardian" } },
    data: { body: "Practise, duel your classmates, and take a championship crown from a Guardian bot. Champions are crowned daily — will the next one be you?" },
  });
  console.log(`5. Updated ${ann.count} announcements`);

  // ── 6. VERIFY every seed question + correct answer in DB ──
  console.log("\n6. VERIFICATION: seed ⇄ database");
  let ok = 0, missing = 0, mismatched = 0;
  for (const [gradeSlug, subjectSlug, topicName, difficulty, text, options, explanation] of ALL_QUESTIONS) {
    const norm = normalize(text);
    const q = await db.question.findUnique({
      where: { normalized: norm },
      include: { options: true, topic: true, subject: true, grade: true },
    });
    if (!q) {
      missing++;
      console.log(`  ✗ MISSING in DB: [${gradeSlug}/${subjectSlug}/${topicName}] "${text.slice(0, 60)}"`);
      continue;
    }
    const correctText = options[0];
    const dbCorrect = q.options.filter((o) => o.isCorrect);
    const found = dbCorrect.length === 1 && dbCorrect[0].text === correctText;
    const extrasOk = q.options.length === options.length;
    if (!found || !extrasOk) {
      mismatched++;
      console.log(`  ✗ MISMATCH: "${text.slice(0, 60)}" — seed correct="${correctText}" db correct=[${dbCorrect.map((c) => c.text).join("|")}] opts=${q.options.length}/${options.length}`);
    } else {
      ok++;
    }
  }
  console.log(`  → ${ok}/${ALL_QUESTIONS.length} verified · ${missing} missing · ${mismatched} mismatched`);

  // Reverse check: any published DB question NOT covered by the seed?
  const dbQuestions = await db.question.findMany({ include: { options: true } });
  const seedNorms = new Set(ALL_QUESTIONS.map(([, , , , text]) => normalize(text)));
  const orphans = dbQuestions.filter((q) => !seedNorms.has(q.normalized ?? ""));
  console.log(`  → DB questions not in seed: ${orphans.length}`);
  orphans.forEach((q) => console.log(`    • Q${q.id} [${q.gradeId}] "${q.text.slice(0, 60)}" status=${q.status}`));

  const stats = {
    total: await db.question.count(),
    published: await db.question.count({ where: { status: "published" } }),
    sources: await db.question.groupBy({ by: ["source"], _count: true }),
    staff: await db.user.findMany({ where: { role: { in: ["admin", "reviewer"] } }, select: { email: true, role: true, displayName: true } }),
  };
  console.log("\nFinal:", JSON.stringify(stats.sources), `${stats.total} total / ${stats.published} published`);
  console.log("Staff:", stats.staff.map((s) => `${s.role}:${s.email}`).join(" · "));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
