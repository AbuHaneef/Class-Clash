/** Exercise GET /champions/[gradeId]/[subjectId] for a real crown (defences path). */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const BASE = 'http://localhost:3000';

async function main() {
  const champ = await db.champion.findFirst({ orderBy: { wonAt: 'asc' } });
  if (!champ) { console.log('no champions in DB — skipping'); return; }
  const res = await fetch(`${BASE}/api/clash/champions/${champ.gradeId}/${champ.subjectId}`);
  const body = await res.json();
  console.log(`champions detail (${champ.gradeId}/${champ.subjectId}):`, res.status,
    'ok=' + body.ok, '| champion=' + (body?.champion?.displayName ?? 'none'), '| history=' + (body?.history?.length ?? 0), '| recentMatches=' + (body?.recentMatches?.length ?? 0));
  if (res.status !== 200 || !body.ok) process.exit(1);
  console.log('✓ champions detail endpoint healthy');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
