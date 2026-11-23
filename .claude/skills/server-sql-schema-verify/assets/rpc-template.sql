-- Portable PL/pgSQL RPC template following ajou-foodmap-server security rules.
-- Replace <fn_name>, parameters, return type, and body, then add matching
-- revoke/grant lines at the bottom of supabase/schema.sql and map custom errors
-- in src/config/supabase.ts (throwDatabaseError).

create or replace function public.<fn_name>(p_actor_id uuid)
returns void
language plpgsql
security invoker
set search_path=''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and is_active and user_type = 'admin'
  ) then
    raise exception 'REVIEWER_NOT_ADMIN' using errcode = '42501';
  end if;

  -- Perform locked/transactional updates against public.* tables here.
end $$;

revoke all on function public.<fn_name>(uuid) from public, anon, authenticated;
grant execute on function public.<fn_name>(uuid) to service_role;
