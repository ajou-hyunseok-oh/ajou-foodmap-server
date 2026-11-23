import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = fs.existsSync(path.join(process.cwd(), 'package.json'))
  ? process.cwd()
  : path.resolve(scriptDir, '../../../..');

const failures = [];
const check = (cond, msg) => {
  if (!cond) failures.push(msg);
};

const schemaSql = fs.readFileSync(path.join(root, 'supabase/schema.sql'), 'utf8');
const lower = schemaSql.toLowerCase();

// 1. RLS enabled on all three core tables
for (const table of ['public.restaurants', 'public.profiles', 'public.submissions']) {
  check(lower.includes(`alter table ${table} enable row level security`),
    `supabase/schema.sql must enable RLS on ${table}`);
}

// 2. Revoke direct anon/authenticated table access & grant service_role
check(/revoke all on table[^;]*?from anon,\s*authenticated/i.test(schemaSql),
  'supabase/schema.sql must revoke table access from anon and authenticated');
check(/grant select,insert,update,delete on table[^;]*?to service_role/i.test(schemaSql),
  'supabase/schema.sql must grant table privileges to service_role');

// 3. Recognized dollar-quoted function definitions must set search_path=''
const functionPattern = /^[ \t]*create\s+(?:or\s+replace\s+)?function\s+([a-z0-9_.]+)\s*\([^)]*\)([^;$]*?)\bas\s+(\$(?:[a-z_][a-z0-9_]*)?\$)([\s\S]*?)\3/gim;
const functionBodies = new Map();
for (const [, fnName, header, , body] of schemaSql.matchAll(functionPattern)) {
  functionBodies.set(fnName.toLowerCase(), body);
  check(/set\s+search_path\s*=\s*''/i.test(header),
    `Function ${fnName} must declare set search_path=''`);
}
check(functionBodies.size >= 5, `Expected at least 5 recognized function names, found ${functionBodies.size}`);

// 4. Check the presence of revocation and grant statements
check(/revoke all on function[^;]*?from public,\s*anon,\s*authenticated/i.test(schemaSql),
  'Expected a function REVOKE statement for PUBLIC, anon, and authenticated');
check(/grant execute on function[^;]*?to service_role/i.test(schemaSql),
  'Expected an RPC execution GRANT statement for service_role');

// 5. Check locking and exception patterns within the RPC that owns them
for (const fnName of ['set_foodmap_user_type', 'deactivate_foodmap_account']) {
  const body = functionBodies.get(`public.${fnName}`) ?? '';
  check(/\block\s+table\s+public\.profiles\s+in\s+share\s+row\s+exclusive\s+mode\b/i.test(body),
    `Function ${fnName} must lock public.profiles for LAST_ADMIN protection`);
  check(/\braise\s+exception\s+'last_admin'/i.test(body),
    `Function ${fnName} must raise LAST_ADMIN`);
}
const approveBody = functionBodies.get('public.approve_foodmap_submission') ?? '';
check(/\braise\s+exception\s+'reviewer_not_admin'/i.test(approveBody),
  'Function approve_foodmap_submission must raise REVIEWER_NOT_ADMIN');
check(/\bfor\s+update\b/i.test(approveBody),
  'Function approve_foodmap_submission must include FOR UPDATE locking');
check(lower.includes("notify pgrst,'reload schema'") || lower.includes("notify pgrst, 'reload schema'"),
  'supabase/schema.sql must notify PostgREST to reload schema');

if (failures.length > 0) {
  console.error('Server SQL security check FAILED:');
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}

console.log(`Server SQL source pattern checks passed (${functionBodies.size} function names recognized).`);
