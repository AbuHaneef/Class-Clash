// ClassClash seed — run with: bunx tsx prisma/seed.ts  (or bun prisma/seed.ts)
import { randomBytes, scryptSync } from "crypto";
import { PrismaClient } from "@prisma/client";
import { LEVELS, GRADES, SUBJECTS, SUBJECT_GRADES, TOPICS, BADGES, MISSIONS, GUARDIANS } from "./seed-data";
import { QUESTIONS_1 } from "./seed-questions-1";
import { QUESTIONS_2 } from "./seed-questions-2";
import type { SeedQuestion } from "./seed-types";

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
  console.log("🌱 Seeding ClassClash…");

  // ── Structure ──
  for (const lvl of LEVELS) {
    await db.educationLevel.upsert({
      where: { slug: lvl.slug },
      create: { name: lvl.name, slug: lvl.slug, order: lvl.order },
      update: { name: lvl.name, order: lvl.order },
    });
  }
  const levels = await db.educationLevel.findMany();
  const levelBySlug = new Map(levels.map((l) => [l.slug, l.id]));

  for (const g of GRADES) {
    await db.grade.upsert({
      where: { slug: g.slug },
      create: {
        name: g.name,
        slug: g.slug,
        order: g.order,
        hasContent: g.hasContent,
        educationLevelId: levelBySlug.get(g.level)!,
      },
      update: { name: g.name, order: g.order, hasContent: g.hasContent },
    });
  }
  const grades = await db.grade.findMany();
  const gradeBySlug = new Map(grades.map((g) => [g.slug, g.id]));

  for (const s of SUBJECTS) {
    await db.subject.upsert({
      where: { slug: s.slug },
      create: { name: s.name, slug: s.slug, icon: s.icon, color: s.color, description: s.description, order: s.order },
      update: { name: s.name, icon: s.icon, color: s.color, description: s.description, order: s.order },
    });
  }
  const subjects = await db.subject.findMany();
  const subjectBySlug = new Map(subjects.map((s) => [s.slug, s.id]));

  for (const sg of SUBJECT_GRADES) {
    for (const sub of sg.subjects) {
      await db.subjectGrade.upsert({
        where: { subjectId_gradeId: { subjectId: subjectBySlug.get(sub)!, gradeId: gradeBySlug.get(sg.grade)! } },
        create: { subjectId: subjectBySlug.get(sub)!, gradeId: gradeBySlug.get(sg.grade)! },
        update: {},
      });
    }
  }

  for (const t of TOPICS) {
    const subjectId = subjectBySlug.get(t.subject)!;
    let order = 0;
    for (const topic of t.topics) {
      order++;
      await db.topic.upsert({
        where: { subjectId_name: { subjectId, name: topic.name } },
        create: { subjectId, name: topic.name, description: topic.description, order },
        update: { description: topic.description, order },
      });
    }
  }
  const topics = await db.topic.findMany();
  const topicByKey = new Map(topics.map((t) => [`${t.subjectId}:${t.name}`, t.id]));

  // ── Question bank (demo content, clearly labelled) ──
  let qCount = 0;
  for (const [gradeSlug, subjectSlug, topicName, difficulty, text, options, explanation] of ALL_QUESTIONS) {
    const gradeId = gradeBySlug.get(gradeSlug);
    const subjectId = subjectBySlug.get(subjectSlug);
    const topicId = topicByKey.get(`${subjectId}:${topicName}`);
    if (!gradeId || !subjectId || !topicId) {
      console.warn(`⚠ Skipping question (missing refs): ${gradeSlug}/${subjectSlug}/${topicName}`);
      continue;
    }
    const norm = normalize(text);
    const existing = await db.question.findUnique({ where: { normalized: norm } });
    if (existing) continue;

    // deterministic shuffle of options by question hash
    const withIdx = options.map((text, i) => ({ text, isCorrect: i === 0 }));
    let seed = norm.length * 31 + options.length;
    for (let i = withIdx.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const j = seed % (i + 1);
      [withIdx[i], withIdx[j]] = [withIdx[j], withIdx[i]];
    }

    const question = await db.question.create({
      data: {
        gradeId,
        subjectId,
        topicId,
        difficulty,
        type: "mcq",
        text,
        normalized: norm,
        points: difficulty === "hard" ? 150 : difficulty === "medium" ? 125 : 100,
        timeLimit: 30,
        explanation,
        status: "published",
        reviewNote: "Reviewed for demo launch bank.",
        source: "ClassClash Demo Bank",
        isDemo: true,
      },
    });
    let order = 0;
    for (const opt of withIdx) {
      order++;
      await db.questionOption.create({
        data: { questionId: question.id, text: opt.text, isCorrect: opt.isCorrect, order },
      });
    }
    qCount++;
  }
  console.log(`   ✎ ${qCount} questions published`);

  // ── Badges & missions ──
  for (const b of BADGES) {
    await db.badge.upsert({
      where: { code: b.code },
      create: b,
      update: { name: b.name, description: b.description, icon: b.icon, color: b.color, xpReward: b.xpReward, sort: b.sort },
    });
  }
  for (const m of MISSIONS) {
    await db.mission.upsert({
      where: { code: m.code },
      create: { ...m, active: true },
      update: { name: m.name, description: m.description, icon: m.icon, metric: m.metric, target: m.target, xpReward: m.xpReward },
    });
  }

  // ── Admin account (demo credentials shown in Help) ──
  await db.user.upsert({
    where: { email: "admin@classclash.demo" },
    create: {
      email: "admin@classclash.demo",
      passwordHash: hashPassword("ClashAdmin#2026"),
      displayName: "Chief Referee",
      avatar: "owl",
      role: "admin",
      onboarded: true,
      gradeId: null,
    },
    update: { role: "admin" },
  });

  // Question reviewer account (demo)
  await db.user.upsert({
    where: { email: "reviewer@classclash.demo" },
    create: {
      email: "reviewer@classclash.demo",
      passwordHash: hashPassword("ClashReview#2026"),
      displayName: "Question Master",
      avatar: "dragon",
      role: "reviewer",
      onboarded: true,
    },
    update: { role: "reviewer" },
  });

  // ── Demo guardians (bots) + initial champion titles ──
  for (const g of GUARDIANS) {
    const gradeId = gradeBySlug.get(g.grade)!;
    const subjectId = subjectBySlug.get(g.subject)!;
    const email = `guardian.${g.grade}.${g.subject}@bots.classclash.demo`;
    const bot = await db.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash: null,
        displayName: g.name,
        avatar: g.avatar,
        role: "student",
        gradeId,
        onboarded: true,
        isDemo: true,
        isBot: true,
        botSkill: g.skill,
      },
      update: { botSkill: g.skill, gradeId },
    });
    const existingChampion = await db.champion.findUnique({
      where: { gradeId_subjectId: { gradeId, subjectId } },
    });
    if (!existingChampion) {
      await db.champion.create({
        data: { gradeId, subjectId, userId: bot.id, defences: 0 },
      });
      await db.championshipHistory.create({
        data: {
          gradeId,
          subjectId,
          formerChampionId: null,
          newChampionId: bot.id,
          note: "Founding demo guardian — beat them to claim the title!",
        },
      });
    }
  }

  // ── Announcement ──
  const existingAnnouncement = await db.announcement.findFirst();
  if (!existingAnnouncement) {
    await db.announcement.create({
      data: {
        title: "Welcome to ClassClash! 🏆",
        body: "Practise, duel your classmates, and take a championship crown from a Demo Guardian. Champions are crowned daily — will the next one be you?",
        active: true,
      },
    });
  }

  // ── Platform config defaults ──
  const defaults: Record<string, string> = {
    arenaQuestions: "7",
    arenaTimePerQuestion: "20",
    challengeQuestions: "8",
    challengeTimePerQuestion: "25",
    challengeExpiryHours: "48",
    maxPendingChallengesPerChampion: "2",
    championChallengeCooldownHours: "12",
    dailyQuestions: "5",
    dailyTimePerQuestion: "30",
    sessionExpiryHours: "2",
    maxQuizQuestions: "20",
  };
  for (const [key, value] of Object.entries(defaults)) {
    await db.platformConfig.upsert({ where: { key }, create: { key, value }, update: {} });
  }

  const stats = {
    grades: (await db.grade.count()),
    subjects: (await db.subject.count()),
    questions: (await db.question.count()),
    guardians: (await db.user.count({ where: { isBot: true } })),
    champions: (await db.champion.count()),
  };
  console.log("✅ Seed complete:", stats);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
