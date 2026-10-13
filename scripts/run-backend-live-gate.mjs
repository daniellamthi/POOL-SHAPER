import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { randomUUID, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Explicit local QA only. No keys/tokens/passwords are printed or persisted.
const env = parseEnv(fs.readFileSync('.env.local', 'utf8'));
const url = 'https://waetxxqdlsuanqescuye.supabase.co';
if (env.SUPABASE_URL !== url || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Wrong target or missing server key');
const pub = process.env.BACKEND_QA_PUBLIC_KEY;
if (!pub) throw new Error('Missing public key');
const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
let userId, token;
const request = async (path, options = {}) => {
  const r = await fetch(url + path, { headers, ...options });
  if (!r.ok) throw new Error(`QA HTTP ${r.status} at ${path.split('?')[0]}`);
  return r.status === 204 ? null : r.json();
};
try {
  const email = `pool-shaper-qa-${randomUUID()}@example.com`;
  const password = randomBytes(32).toString('base64url');
  const user = await request('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true, app_metadata: { purpose: 'build2-disposable-qa' } }) });
  userId = user.id;
  const session = await request('/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: pub, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  token = session.access_token;
  if (!token || session.user?.id !== userId) throw new Error('Invalid QA session');
  console.log('PASS — dedicated authenticated QA session created (no email sent)');
  const result = spawnSync(process.execPath, ['scripts/run-project-delivery-audit.mjs'], {
    stdio: 'inherit', env: { ...process.env, SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
      PROJECT_AUDIT_LIVE: '1', PROJECT_AUDIT_SUPABASE_URL: url,
      PROJECT_AUDIT_EXPECTED_REF: 'waetxxqdlsuanqescuye',
      PROJECT_AUDIT_SERVICE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
      PROJECT_AUDIT_ANON_KEY: pub, PROJECT_AUDIT_AUTHENTICATED_KEY: token,
    },
  });
  process.exitCode = result.status ?? 1;
  for (const [role, auth] of [['anon', { apikey: pub }], ['authenticated', { apikey: pub, Authorization: `Bearer ${token}` }]]) {
    const read = await request('/rest/v1/leads?select=request_id&limit=1', { headers: auth });
    if (!Array.isArray(read) || read.length !== 0) throw new Error(`${role} could read private leads`);
    console.log(`PASS — ${role}: private leads invisible through real REST session`);
  }
} finally {
  if (token) {
    const out = await fetch(url + '/auth/v1/logout?scope=global', { method: 'POST', headers: { apikey: pub, Authorization: `Bearer ${token}` } });
    if (!out.ok) throw new Error('QA signout failed');
  }
  if (userId) {
    await request('/auth/v1/admin/users/' + userId, { method: 'DELETE' });
    console.log('PASS — QA sessions revoked and disposable user deleted');
  }
}
