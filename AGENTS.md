# Ajou FoodMap Server Guidelines

## Tech Stack & Workspace Map
- Runtime & toolchain: Express 5.1, TypeScript 5.9 (`"type": "commonjs"`, `module: "Node16"`), `@supabase/supabase-js` 2.118, Node 24.x.
- Package manager: `npm` only (`package-lock.json` is tracked; do not add `pnpm`/`yarn` lockfiles).
- Core directories:
  - `server.ts`: loads `dotenv/config` and boots `createApp()` on `PORT` (default `3000`).
  - `src/app.ts`: CORS allowlist (`CLIENT_URL`, `credentials: false`), `express.json({ limit: "100kb" })`, `/health`, API routers, `notFound`, and `errorHandler`.
  - `src/routes/`: `auth.routes.ts`, `users.routes.ts`, `restaurants.routes.ts`, `submissions.routes.ts`.
  - `src/middleware/`: `auth.middleware.ts` (`isAuthenticated`, `requireAdmin`), `notFound.middleware.ts`, `error.middleware.ts`.
  - `src/controllers/` & `src/services/`: domain controllers/services for restaurants, submissions, users, and auth providers.
  - `src/config/supabase.ts`: singleton server Supabase client (`SUPABASE_SECRET_KEY`) and PostgreSQL-to-`HttpError` mapping (`throwDatabaseError`).
  - `src/types/` & `src/utils/`: DTO/DB types (`auth.types.ts`, `database.types.ts`, `restaurant.types.ts`), `asyncHandler`, `HttpError`, `input`.
  - `supabase/`: idempotent PostgreSQL schema, triggers, RPC functions, RLS/grants (`schema.sql`), and seed data (`seed.sql`).
  - `tests/`: Jest + Supertest API/service tests (`*.test.ts`) and PGlite PostgreSQL schema tests (`tests/schema.postgres.ts`).
  - `scripts/`: operational scripts (`check-db.ts`, `check-auth.ts`, `verify-live.ts`, `change-user-type.ts`, `setup-naver-oidc.ts`).

## Verification Commands
Select offline checks for the changed behavior. Install dependencies with `npm ci` if a selected check needs them and `node_modules` is absent.
- TypeScript changes: `npm run typecheck` and the relevant Jest files. For route guards and app wiring, run `npm exec --no -- jest --runInBand tests/api.test.ts`.
- Schema or seed changes: `npm run test:sql` runs the PGlite tests.
- Expand coverage when requested, required, justified by an affected shared dependency, or needed to diagnose a related failure. `npm test` runs all Jest and PGlite tests. Use `npm run build` to verify production compilation when build configuration or emitted output is affected.
- For instruction or documentation changes, check the changed text, formatting, and referenced paths. If a bundled verification script changes, check that script directly.
- Live environment scripts (`db:check`, `auth:check`, `test:live`, `change-user-type`, `auth:setup-naver`) touch real Supabase projects—run only when explicitly requested with configured `.env`.

## Non-Inferable Architecture & Contract Rules
- Stateless auth & middleware ordering:
  - Always verify Bearer JWTs through `db.auth.getUser(token)` in `src/middleware/auth.middleware.ts`. Derive the acting user's identity and role from `req.auth`. Validate target IDs and requested roles as operation inputs.
  - Look up `public.profiles` by verified UUID and require `is_active === true`. Return `401` for a missing or invalid token, `403` for a missing or inactive profile or a non-admin on an admin route, and `503` when Auth is unavailable.
  - Run `isAuthenticated` before `requireAdmin`. Mount `notFound` and then `errorHandler` last in `src/app.ts`.
- Server Supabase & PostgreSQL invariants:
  - Keep `persistSession: false`, `autoRefreshToken: false`, `detectSessionInUrl: false` in `src/config/supabase.ts` (uses `SUPABASE_SECRET_KEY`).
  - Enable RLS on `profiles`, `submissions`, and `restaurants`. Revoke table privileges from `anon` and `authenticated` and function execution from `PUBLIC`, `anon`, and `authenticated`. Grant the required table, sequence, and callable RPC privileges to `service_role`. Keep trigger-only functions out of the RPC grants.
  - Declare `set search_path=''` on schema functions and keep `notify pgrst, 'reload schema'` before commit. Keep Auth passwords, hashes, salts, and tokens out of public tables. Preserve the RPC exception mappings in `throwDatabaseError()`.
  - Keep new profiles at `user_type = 'user'` via the database default used by `foodmap_handle_new_user()`, regardless of client metadata.
  - Preserve `LAST_ADMIN` serialization locks (`set_foodmap_user_type`, `deactivate_foodmap_account` -> `409`) and transactional/idempotent approval (`approve_foodmap_submission` with `for update` and unique `source_submission_id`).
- Response & CORS contract:
  - Restaurant, submission, and auth-provider JSON responses use `{ data }`. User/profile reads and updates, including `GET /api/auth/me`, use `{ success: true, data }`. `DELETE /api/users/account` returns `200` with `{ success: true, message }`. Restaurant and submission deletes return an empty `204`. Submission approval returns `200`. `GET /health` returns `{ status: "ok" }`.
  - Use `HttpError` for application errors and keep the `errorHandler` response shape `{ success: false, message, error: { message } }`. The `notFound` handler for unmatched routes returns `404` with `{ error: { message } }`.
  - Keep the comma-separated `CLIENT_URL` CORS allowlist, `allowedHeaders: ["Content-Type", "Authorization"]`, `credentials: false`, and the `100kb` JSON body limit.

## Secrets
- Keep `SUPABASE_SECRET_KEY`, `NAVER_CLIENT_ID`, and `NAVER_CLIENT_SECRET` strictly server-side; never expose them in API responses, logs, tests, or client env files.
- Keep actual credentials out of tracked files and keep `.env.example` readable. Shell access to secrets depends on the active sandbox and OS permissions.
