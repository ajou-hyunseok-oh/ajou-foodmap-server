---
name: server-auth-route-check
description: >
  Verifies Express route guards, isAuthenticated and requireAdmin ordering,
  401/403 role matrix, CORS and error middleware, and Jest API tests in
  ajou-foodmap-server. Use when modifying src/routes/, src/middleware/,
  src/controllers/, src/config/supabase.ts, or src/app.ts. Do not use for
  documentation-only edits or SQL seed data changes.
compatibility: Requires Node.js 24.x and npm
---

# Server Auth & Route Guard Verification

## Workflow
1. Review affected endpoints against the [role and response matrix](references/role-matrix.md). Preserve the order of `isAuthenticated` and `requireAdmin` and use `req.auth` for the acting user's identity and role.
2. For changes to guards or app wiring, run the [source check](scripts/verify-route-guards.mjs) from the repository root:
   - `node .agents/skills/server-auth-route-check/scripts/verify-route-guards.mjs`
   - The script checks selected source patterns. Use Jest to verify request behavior.
3. For TypeScript changes, run `npm run typecheck`. For changes to route guards, CORS, or the HTTP contract, run `npm exec --no -- jest --runInBand tests/api.test.ts`. Select `tests/auth-providers.test.ts` when provider discovery changes, or `tests/services.test.ts` when the changed behavior is in a service.
4. Run `npm ci` if a selected npm check needs dependencies and `node_modules` is absent. Expand coverage when requested, required for the change, justified by affected shared behavior, or needed to diagnose a related failure. `npm test` runs all Jest and PGlite tests. Run `npm run build` when production compilation is affected.
5. Run live Supabase scripts only when explicitly requested and the environment is configured.
