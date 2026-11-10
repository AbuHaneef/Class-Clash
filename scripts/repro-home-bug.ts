/** Reproduce: open-invite challenge (opponent null) crashes GET /api/clash/home. */
const BASE = 'http://localhost:3000';
const email = `bugcheck-home-${Date.now()}@test.local`;
const name = `HBC${String(Date.now()).slice(-3)}`;

async function main() {
  // 1. register + onboard a student
  const reg = await fetch(`${BASE}/api/clash/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test#Pass123', displayName: name }),
  });
  const regBody = await reg.json();
  const setCookies = (reg.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  const cookie = setCookies[0]?.split(';')[0] ?? reg.headers.get('set-cookie')?.split(';')[0] ?? '';
  console.log('register:', reg.status, 'cookie set:', cookie.length > 0, 'body:', JSON.stringify(regBody).slice(0, 200));
  const me0 = regBody.user ?? (await (await fetch(`${BASE}/api/clash/auth/me`, { headers: { cookie } })).json()).user;

  const structureRes = await (await fetch(`${BASE}/api/clash/structure`)).json();
  const structure = structureRes.structure;
  const jss3 = structure.grades.find((g: { slug: string }) => g.slug === 'jss-3');
  const math = structure.subjects.find((s: { slug: string }) => s.slug === 'mathematics');

  await fetch(`${BASE}/api/clash/onboarding`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ displayName: name, avatar: 'fox', gradeId: jss3.id, subjectIds: [math.id], interests: [] }),
  });

  // 2. baseline home (before open invite)
  const homeBefore = await fetch(`${BASE}/api/clash/home`, { headers: { cookie } });
  console.log('home BEFORE open invite:', homeBefore.status);

  // 3. create an OPEN-INVITE duel (no opponentId)
  const create = await fetch(`${BASE}/api/clash/challenges`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'duel', subjectId: math.id }),
  });
  const createBody = await create.json();
  console.log('create open-invite duel:', create.status, JSON.stringify(createBody).slice(0, 150));

  // 4. home AFTER open invite — expected 500 if bug is live
  const homeAfter = await fetch(`${BASE}/api/clash/home`, { headers: { cookie } });
  const afterBody = await homeAfter.json();
  console.log('home AFTER open invite:', homeAfter.status, JSON.stringify(afterBody).slice(0, 150));

  // cleanup: delete ALL repro leftovers (this run + any from earlier crashed runs)
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient();
  try {
    if (createBody?.challenge?.id) {
      await db.challengeResult.deleteMany({ where: { challengeId: createBody.challenge.id } });
      await db.challenge.delete({ where: { id: createBody.challenge.id } });
    }
    const leftovers = await db.user.findMany({
      where: { OR: [{ email: { startsWith: 'bugcheck-home-' } }, { displayName: { startsWith: 'HBC' } }] },
    });
    for (const u of leftovers) {
      const created = await db.challenge.findMany({ where: { creatorId: u.id }, select: { id: true } });
      for (const c of created) {
        await db.challengeResult.deleteMany({ where: { challengeId: c.id } });
        await db.challenge.deleteMany({ where: { id: c.id } });
      }
      await db.notification.deleteMany({ where: { userId: u.id } });
      await db.authSession.deleteMany({ where: { userId: u.id } });
      await db.quizSession.deleteMany({ where: { userId: u.id } });
      await db.xPTransaction.deleteMany({ where: { userId: u.id } });
      await db.user.delete({ where: { id: u.id } });
    }
    console.log(`cleanup done (${leftovers.length} leftover users removed)`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(1); });

export {};
