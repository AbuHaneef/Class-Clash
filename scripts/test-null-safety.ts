/**
 * Verify the endpoints touched by the null-safety fixes work with open-invite
 * challenges: GET /challenges, GET /challenges/[id], GET /home, GET /schools,
 * champions detail, missions claim.
 */
const BASE = 'http://localhost:3000';
const email = `nullcheck-${Date.now()}@test.local`;
const name = `NC${String(Date.now()).slice(-3)}`;

async function main() {
  const reg = await fetch(`${BASE}/api/clash/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test#Pass123', displayName: name }),
  });
  const setCookies = (reg.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  const cookie = setCookies[0]?.split(';')[0] ?? '';
  if (reg.status !== 200) { console.log('register failed', reg.status, await reg.text()); process.exit(1); }

  const structureRes = await (await fetch(`${BASE}/api/clash/structure`)).json();
  const structure = structureRes.structure;
  const jss3 = structure.grades.find((g: { slug: string }) => g.slug === 'jss-3');
  const math = structure.subjects.find((s: { slug: string }) => s.slug === 'mathematics');

  await fetch(`${BASE}/api/clash/onboarding`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ displayName: name, avatar: 'fox', gradeId: jss3.id, subjectIds: [math.id], interests: [] }),
  });

  let failures = 0;
  const check = (label: string, status: number, ok?: boolean) => {
    const good = status === 200 && ok !== false;
    if (!good) failures++;
    console.log(`  ${good ? '✓' : '✗'} ${label}: ${status}${ok === false ? ' (ok:false)' : ''}`);
  };

  // 1. create open-invite duel
  const create = await fetch(`${BASE}/api/clash/challenges`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'duel', subjectId: math.id }),
  });
  const createBody = await create.json();
  check('create open-invite duel', create.status, createBody.ok);
  const challengeId = createBody?.challenge?.id;

  // 2. GET /challenges (list with open invite)
  const list = await fetch(`${BASE}/api/clash/challenges`, { headers: { cookie } });
  const listBody = await list.json();
  const mine = listBody?.challenges?.find((c: { id: string }) => c.id === challengeId);
  check('GET /challenges (open invite in list)', list.status, listBody.ok && mine && mine.openInvite === true && mine.opponent === null);

  // 3. GET /challenges/[id] (detail with open invite + null opponent result)
  const detail = await fetch(`${BASE}/api/clash/challenges/${challengeId}`, { headers: { cookie } });
  const detailBody = await detail.json();
  check('GET /challenges/[id] (null opponent result)', detail.status,
    detailBody.ok && detailBody?.challenge?.opponentResult === null);

  // 4. GET /home (dashboard with pending open invite)
  const home = await fetch(`${BASE}/api/clash/home`, { headers: { cookie } });
  const homeBody = await home.json();
  const active = homeBody?.activeChallenges?.find((c: { id: string }) => c.id === challengeId);
  check('GET /home (open invite listed, no crash)', home.status,
    homeBody.ok && active && active.opponentName === 'Open invite');

  // 5. GET /schools (league table)
  const schools = await fetch(`${BASE}/api/clash/schools`, { headers: { cookie } });
  const schoolsBody = await schools.json();
  check('GET /schools (league table)', schools.status, schoolsBody.ok);

  // 6. GET /tournaments (fixed endpoint)
  const tournaments = await fetch(`${BASE}/api/clash/tournaments`, { headers: { cookie } });
  const tournamentsBody = await tournaments.json();
  check('GET /tournaments', tournaments.status, tournamentsBody.ok);

  // 7. missions claim (invalid code → graceful, not crash)
  const claim = await fetch(`${BASE}/api/clash/missions/claim`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ missionCode: 'nonexistent' }),
  });
  const claimBody = await claim.json();
  check('POST /missions/claim (graceful miss)', claim.status,
    claimBody.ok && claimBody.awarded === 0 && claimBody.levelUp === false);

  // 8. champions detail (grade/subject board with defences)
  const champBoard = await fetch(`${BASE}/api/clash/champions`, { headers: { cookie } });
  const champBody = await champBoard.json();
  check('GET /champions', champBoard.status, champBody.ok);
  if (champBody?.boards?.length) {
    const b = champBody.boards[0];
    const d = await fetch(`${BASE}/api/clash/champions/${b.gradeId}/${b.subjectId}`, { headers: { cookie } });
    const dBody = await d.json();
    check(`GET /champions/${b.gradeId}/${b.subjectId} (detail)`, d.status, dBody.ok);
  }

  console.log(failures === 0 ? '\n═══ ALL NULL-SAFETY CHECKS PASSED ═══' : `\n═══ ${failures} FAILURES ═══`);

  // cleanup
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient();
  try {
    if (challengeId) {
      await db.challengeResult.deleteMany({ where: { challengeId } });
      await db.challenge.delete({ where: { id: challengeId } });
    }
    const leftovers = await db.user.findMany({
      where: { OR: [{ email: { startsWith: 'nullcheck-' } }, { displayName: { startsWith: 'NC' } }] },
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
    console.log(`cleanup done (${leftovers.length} removed)`);
  } finally {
    await db.$disconnect();
  }
  if (failures > 0) process.exit(1);
}

main().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(1); });

export {};
