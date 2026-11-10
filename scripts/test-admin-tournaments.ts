/** Verify admin tournaments GET works after the include fix. */
const BASE = 'http://localhost:3000';

async function main() {
  // login as admin
  const loginRes = await fetch(`${BASE}/api/clash/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@classclash.com', password: 'Admin#ClassClash2026' }),
  });
  const login = await loginRes.json();
  if (!login.ok) { console.log('LOGIN FAILED', login); process.exit(1); }
  const cookie = loginRes.headers.get('set-cookie')?.split(';')[0] ?? '';

  const res = await fetch(`${BASE}/api/clash/admin/tournaments`, { headers: { cookie } });
  const body = await res.json();
  console.log('admin tournaments GET:', res.status, JSON.stringify(body).slice(0, 200));
  if (res.status !== 200 || !body.ok) { console.log('❌ FAILED'); process.exit(1); }
  console.log('✓ admin tournaments endpoint healthy');
}

main().catch((e) => { console.error(e); process.exit(1); });

export {};
