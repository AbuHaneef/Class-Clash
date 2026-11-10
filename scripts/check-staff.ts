import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const staff = await db.user.findMany({
  where: { role: { in: ["admin", "reviewer"] } },
  select: { email: true, role: true, onboarded: true, gradeId: true, suspendedUntil: true },
});
console.log(JSON.stringify(staff, null, 2));
await db.$disconnect();
