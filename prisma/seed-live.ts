// ClassClash live-duels & school-leagues seed — idempotent.
// Run: bun prisma/seed-live.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// ── Live trainer bots (one per content grade) ────────────────
// Instant live-duel sparring partners. Emails start with
// "live-trainer-" — the live engine looks them up by that prefix.
const TRAINERS: { grade: string; name: string; skill: number; avatar: string }[] = [
  { grade: "primary-6", name: "Blitz Bee", skill: 0.62, avatar: "bee" },
  { grade: "jss-2", name: "Volt Fox", skill: 0.68, avatar: "fox" },
  { grade: "jss-3", name: "Zap Dragon", skill: 0.72, avatar: "dragon" },
  { grade: "ss-2", name: "Swift Owl", skill: 0.74, avatar: "owl" },
  { grade: "ss-3", name: "Ace Alien", skill: 0.76, avatar: "alien" },
];

// ── Demo schools (staffed by guardian bots) ──────────────────
const SCHOOLS: {
  name: string;
  motto: string;
  color: string;
  grades: string[];
}[] = [
  { name: "Lagos Legacy Academy", motto: "Knowledge is power", color: "#f5c518", grades: ["primary-6"] },
  { name: "Abuja Unity College", motto: "Stronger together", color: "#a855f7", grades: ["jss-2"] },
  { name: "Kano Scholars Hall", motto: "Learn, lead, succeed", color: "#10b981", grades: ["jss-3"] },
  { name: "Port Harcourt Champions", motto: "Excellence every day", color: "#f43f5e", grades: ["ss-2", "ss-3"] },
];

function joinCode(len = 6): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function main() {
  console.log("🌱 Seeding live trainers & demo schools…");

  const grades = await db.grade.findMany();
  const gradeBySlug = new Map(grades.map((g) => [g.slug, g.id]));

  // 1. Live trainers
  for (const t of TRAINERS) {
    const gradeId = gradeBySlug.get(t.grade);
    if (!gradeId) {
      console.warn(`⚠ missing grade ${t.grade}`);
      continue;
    }
    const email = `live-trainer-${t.grade}@classclash.demo`;
    await db.user.upsert({
      where: { email },
      create: {
        email,
        displayName: t.name,
        avatar: t.avatar,
        role: "student",
        gradeId,
        onboarded: true,
        isDemo: true,
        isBot: true,
        botSkill: t.skill,
        rating: 1000,
      },
      update: { botSkill: t.skill, gradeId, isBot: true, isDemo: true, onboarded: true },
    });
    console.log(`  • trainer ${t.name} (${t.grade}, skill ${t.skill})`);
  }

  // 2. Demo schools — members are the guardian bots of their grades
  const guardians = await db.user.findMany({
    where: { isBot: true, isDemo: true, email: { startsWith: "guardian." } },
  });
  const guardianByGrade = new Map<string, typeof guardians>();
  for (const g of guardians) {
    if (!g.gradeId) continue;
    const slug = grades.find((x) => x.id === g.gradeId)?.slug;
    if (!slug) continue;
    const list = guardianByGrade.get(slug) ?? [];
    list.push(g);
    guardianByGrade.set(slug, list);
  }

  for (const s of SCHOOLS) {
    const school = await db.school.upsert({
      where: { name: s.name },
      create: {
        name: s.name,
        slug: slugify(s.name),
        motto: s.motto,
        color: s.color,
        joinCode: joinCode(),
      },
      update: { motto: s.motto, color: s.color },
    });

    // enroll guardians of the school's grades + give them season points
    let enrolled = 0;
    for (const gradeSlug of s.grades) {
      for (const g of guardianByGrade.get(gradeSlug) ?? []) {
        // deterministic, stable season points so the table looks alive
        const pts = 18 + Math.round((g.botSkill ?? 0.6) * 60);
        await db.user.update({
          where: { id: g.id },
          data: { schoolId: school.id, seasonPoints: pts },
        });
        enrolled++;
      }
    }
    console.log(`  • school ${s.name} — ${enrolled} members`);
  }

  const schoolCount = await db.school.count();
  const trainerCount = await db.user.count({ where: { email: { startsWith: "live-trainer-" } } });
  console.log(`✅ Done. ${schoolCount} schools, ${trainerCount} live trainers.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
