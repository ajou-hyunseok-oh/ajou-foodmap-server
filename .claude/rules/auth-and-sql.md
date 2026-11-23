---
paths:
  - "src/app.ts"
  - "src/routes/**"
  - "src/middleware/**"
  - "src/config/supabase.ts"
  - "src/controllers/**"
  - "src/services/**"
  - "supabase/**"
---

# Server Auth, Route Guard & SQL Invariant Rules

- Keep `isAuthenticated` strictly before `requireAdmin` on every admin endpoint (`users`, `restaurants` writes, `submissions` review routes).
- Derive the acting user's ID and role from `req.auth` after `db.auth.getUser(token)`. Validate the target `userId` route parameter and requested `userType` body field as inputs to the admin role-change operation.
- Keep `src/config/supabase.ts` stateless (`persistSession: false`, `autoRefreshToken: false`, `detectSessionInUrl: false`) and preserve the existing RPC error mappings in `throwDatabaseError`, including `INVALID_USER_TYPE` through SQLSTATE `23514`.
- Keep `src/app.ts` mounting `notFound` and `errorHandler` last and preserving `credentials: false` with `allowedHeaders: ["Content-Type", "Authorization"]`.
- Declare `set search_path=''` for each schema function and revoke execution from `PUBLIC`, `anon`, and `authenticated`. Grant `EXECUTE` to `service_role` for callable RPCs only. Preserve RLS and `notify pgrst, 'reload schema'` before commit.
- Never copy auth passwords, hashes, salts, or tokens into `public.*` tables.
