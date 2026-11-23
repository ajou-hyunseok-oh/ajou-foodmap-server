# Ajou FoodMap SQL Schema & RPC Security Invariants

## 1. Tables & Constraints (`supabase/schema.sql`)
- `public.profiles`: `id uuid primary key references auth.users(id) on delete cascade`, `user_type in ('user', 'admin')` default `'user'`, `is_active boolean default true`, `name` trimmed length `1..80`.
- `public.submissions`: `status in ('pending', 'approved', 'rejected')` default `'pending'`, `submitter_id` / `reviewed_by` reference `public.profiles(id)`.
- `public.restaurants`: `source_submission_id bigint unique references public.submissions(id) on delete set null`, `rating between 0 and 5`, `likes >= 0`.

## 2. Trigger & RPC Safety Rules
- `foodmap_handle_new_user()`: `security definer set search_path=''`, always creates profiles with default `user_type = 'user'` regardless of client metadata; never copies Auth password hashes, salts, or tokens into `public.*`.
- `set_foodmap_user_type(p_user_id, p_user_type)` and `deactivate_foodmap_account(p_user_id)`: acquire `lock table public.profiles in share row exclusive mode` and raise `LAST_ADMIN` when attempting to demote or deactivate the sole remaining active admin (`409` in `throwDatabaseError`).
- `approve_foodmap_submission(p_submission_id, p_reviewer_id)`: verifies active admin reviewer (`REVIEWER_NOT_ADMIN` -> `403`), locks target submission `for update`, returns existing restaurant idempotently if already `approved`, otherwise inserts into `restaurants` and marks submission `approved` in one transaction.

## 3. RLS, Grants & PostgREST Reload
- Enable RLS on `public.restaurants`, `public.profiles`, and `public.submissions`.
- Revoke table privileges from `anon` and `authenticated`. Revoke function execution from `PUBLIC`, `anon`, and `authenticated` for callable RPCs and trigger-only functions.
- Grant the required table and sequence privileges to `service_role`. Grant `EXECUTE` to `service_role` for callable RPCs only.
- End `supabase/schema.sql` with `notify pgrst,'reload schema';` before `commit;`.
- Keep `schema.sql` and `seed.sql` safe to re-run without wiping existing profiles or restaurants (verified by `tests/schema.postgres.ts` via PGlite).
