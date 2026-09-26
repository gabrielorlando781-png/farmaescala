-- O limite é fixo no banco: o cliente não pode escolher um valor maior.
revoke all on function public.consume_ai_request(integer) from public, anon, authenticated;

create or replace function public.get_ai_daily_usage()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  usage_day date := (now() at time zone 'America/Sao_Paulo')::date;
  used_count integer;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  select request_count into used_count
  from public.ai_daily_usage
  where user_id = auth.uid() and usage_date = usage_day;
  used_count := coalesce(used_count, 0);
  return jsonb_build_object(
    'used', used_count, 'remaining', greatest(0, 20 - used_count), 'limit', 20,
    'resetsAt', ((usage_day + 1)::timestamp at time zone 'America/Sao_Paulo')
  );
end;
$$;

create or replace function public.consume_ai_request_v2()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  usage_day date := (now() at time zone 'America/Sao_Paulo')::date;
  used_count integer;
  accepted boolean := false;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  insert into public.ai_daily_usage (user_id, usage_date, request_count)
  values (auth.uid(), usage_day, 1)
  on conflict (user_id, usage_date) do update
    set request_count = public.ai_daily_usage.request_count + 1
    where public.ai_daily_usage.request_count < 20
  returning request_count into used_count;
  accepted := found;
  if not accepted then
    select request_count into used_count from public.ai_daily_usage
    where user_id = auth.uid() and usage_date = usage_day;
  end if;
  used_count := coalesce(used_count, 0);
  return jsonb_build_object(
    'allowed', accepted, 'used', used_count,
    'remaining', greatest(0, 20 - used_count), 'limit', 20,
    'resetsAt', ((usage_day + 1)::timestamp at time zone 'America/Sao_Paulo')
  );
end;
$$;

revoke all on function public.get_ai_daily_usage() from public, anon;
revoke all on function public.consume_ai_request_v2() from public, anon;
grant execute on function public.get_ai_daily_usage() to authenticated;
grant execute on function public.consume_ai_request_v2() to authenticated;

create or replace function public.platform_admin_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito ao administrador da plataforma';
  end if;
  return jsonb_build_object(
    'networks', (select count(*) from public.organizations),
    'activeNetworks', (select count(*) from public.organizations where active),
    'stores', (select count(*) from public.stores),
    'activeStores', (select count(*) from public.stores where active),
    'storeManagers', (select count(distinct user_id) from public.store_memberships where role = 'store_manager' and active),
    'networkOwners', (select count(distinct user_id) from public.organization_memberships where role = 'network_owner' and active)
  );
end;
$$;

revoke all on function public.platform_admin_metrics() from public, anon;
grant execute on function public.platform_admin_metrics() to authenticated;
