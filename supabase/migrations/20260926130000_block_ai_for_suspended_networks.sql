-- As Edge Functions da IA chamam esta função antes do Gemini. Uma conta
-- autenticada sem rede/filial ativa não pode consumir a IA por chamada direta.
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
  if not public.is_platform_admin()
    and not exists (
      select 1 from public.organization_memberships om
      join public.organizations o on o.id = om.organization_id
      where om.user_id = auth.uid() and om.active and o.active
        and om.role in ('network_owner', 'network_admin')
    )
    and not exists (
      select 1 from public.store_memberships sm
      join public.stores s on s.id = sm.store_id
      join public.organizations o on o.id = s.organization_id
      where sm.user_id = auth.uid() and sm.active and sm.role = 'store_manager'
        and s.active and o.active
    )
  then
    raise exception 'Sua rede ou filial não está ativa para usar a IA.';
  end if;

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
