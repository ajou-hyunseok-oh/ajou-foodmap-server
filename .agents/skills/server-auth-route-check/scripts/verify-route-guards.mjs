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

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

// 1. src/app.ts wiring: CORS options and relative error middleware order
const appTs = read('src/app.ts');
check(appTs.includes('credentials: false'), 'src/app.ts must keep CORS credentials: false');
check(appTs.includes('"Authorization"') || appTs.includes("'Authorization'"),
  'src/app.ts must allow Authorization header in CORS');
const notFoundIdx = appTs.indexOf('app.use(notFound)');
const errorIdx = appTs.indexOf('app.use(errorHandler)');
check(notFoundIdx !== -1 && errorIdx !== -1 && notFoundIdx < errorIdx,
  'src/app.ts must register notFound before errorHandler');

// 2. auth.middleware.ts: db.auth.getUser verification + active check + requireAdmin
const authMw = read('src/middleware/auth.middleware.ts');
check(authMw.includes('db.auth.getUser('), 'auth.middleware.ts must verify Bearer JWT via db.auth.getUser');
check(authMw.includes('is_active'), 'auth.middleware.ts must reject inactive profiles');
check(authMw.includes('req.auth?.userType !== "admin"') || authMw.includes("req.auth?.userType !== 'admin'"),
  'auth.middleware.ts must enforce admin userType in requireAdmin');

// 3. src/config/supabase.ts: stateless server client + SUPABASE_SECRET_KEY
const supabaseTs = read('src/config/supabase.ts');
check(supabaseTs.includes('SUPABASE_SECRET_KEY'), 'src/config/supabase.ts must read SUPABASE_SECRET_KEY');
for (const flag of ['persistSession: false', 'autoRefreshToken: false', 'detectSessionInUrl: false']) {
  check(supabaseTs.includes(flag), `src/config/supabase.ts must set ${flag}`);
}

// 4. auth.routes.ts: /me guarded by isAuthenticated
const authRoutes = read('src/routes/auth.routes.ts');
check(/router\.get\(\s*["']\/me["']\s*,\s*isAuthenticated/.test(authRoutes),
  'src/routes/auth.routes.ts must protect GET /me with isAuthenticated');

// 5. users.routes.ts: router.use(isAuthenticated) before all routes; admin guard on /all and /:userId/type
const usersRoutes = read('src/routes/users.routes.ts');
const usersAuth = /\brouter\.use\s*\(\s*isAuthenticated\s*\)/.exec(usersRoutes);
const firstUsersRoute = /\brouter\.(?:get|post|put|patch|delete)\s*\(/.exec(usersRoutes);
check(usersAuth && firstUsersRoute && usersAuth.index < firstUsersRoute.index,
  'src/routes/users.routes.ts must apply router.use(isAuthenticated) before registering user routes');
check(/router\.get\(\s*["']\/all["']\s*,\s*requireAdmin/.test(usersRoutes),
  'src/routes/users.routes.ts must protect GET /all with requireAdmin');
check(/router\.put\(\s*["']\/:userId\/type["']\s*,\s*requireAdmin/.test(usersRoutes),
  'src/routes/users.routes.ts must protect PUT /:userId/type with requireAdmin');

// 6. restaurants.routes.ts: POST/PUT/DELETE require isAuthenticated then requireAdmin
const restRoutes = read('src/routes/restaurants.routes.ts');
for (const method of ['post', 'put', 'delete']) {
  const re = new RegExp(`router\\.${method}\\([^\\n]*isAuthenticated\\s*,\\s*requireAdmin`);
  check(re.test(restRoutes), `src/routes/restaurants.routes.ts must guard ${method.toUpperCase()} with isAuthenticated, requireAdmin`);
}

// 7. submissions.routes.ts: isAuthenticated -> POST / -> requireAdmin -> review endpoints
const subRoutes = read('src/routes/submissions.routes.ts');
const subAuthIdx = subRoutes.indexOf('router.use(isAuthenticated)');
const subPostIdx = subRoutes.indexOf('router.post("/"');
const subAdminIdx = subRoutes.indexOf('router.use(requireAdmin)');
const subApproveIdx = subRoutes.indexOf('approve');
check(subAuthIdx !== -1 && subPostIdx > subAuthIdx && subAdminIdx > subPostIdx && subApproveIdx > subAdminIdx,
  'src/routes/submissions.routes.ts must enforce order: isAuthenticated -> POST / -> requireAdmin -> admin review routes');

if (failures.length > 0) {
  console.error('Server auth/route guard check FAILED:');
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}

console.log('Server auth/route source pattern checks passed.');
