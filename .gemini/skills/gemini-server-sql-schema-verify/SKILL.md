---
name: gemini-server-sql-schema-verify
description: >
  Validates supabase/schema.sql, supabase/seed.sql, PostgreSQL RLS policies,
  service_role grants, search_path='' RPC functions, and PGlite tests in
  ajou-foodmap-server. Use when editing the schema, seed data, or RPC error
  mappings. Do not use for Express CORS or Jest mock-only edits.
compatibility: Requires Node.js 24.x and npm
---

# Server SQL Schema & RPC Verification

## Workflow
1. Review the [SQL invariants](references/sql-invariants.md) relevant to the change. For a new administrator RPC, adapt the [RPC template](assets/rpc-template.sql) to its authorization and error contract.
2. For changes to `supabase/schema.sql`, run the [source check](scripts/verify-sql-security.mjs) from the repository root:
   - `node .gemini/skills/gemini-server-sql-schema-verify/scripts/verify-sql-security.mjs`
   - The script checks selected SQL patterns. Review each affected grant and use PGlite tests to verify database behavior.
3. For schema or seed changes, run `npm run test:sql`. For TypeScript error-mapping changes, check the HTTP status in `throwDatabaseError()` and run `npm run typecheck` and `npm exec --no -- jest --runInBand tests/services.test.ts`.
4. Run `npm ci` if a selected npm check needs dependencies and `node_modules` is absent. Expand coverage when requested, required for the change, justified by affected shared behavior, or needed to diagnose a related failure. `npm test` runs all Jest and PGlite tests. Run `npm run build` when production compilation is affected.
5. Run live Supabase scripts only when explicitly requested and the environment is configured.
