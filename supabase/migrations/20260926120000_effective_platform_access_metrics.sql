-- "Ativo" no painel significa acesso efetivo, não apenas a marcação
-- individual da filial ou do vínculo enquanto a rede está suspensa.
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
    'activeStores', (
      select count(*) from public.stores s
      join public.organizations o on o.id = s.organization_id
      where s.active and o.active
    ),
    'storeManagers', (
      select count(distinct sm.user_id) from public.store_memberships sm
      join public.stores s on s.id = sm.store_id
      join public.organizations o on o.id = s.organization_id
      where sm.role = 'store_manager' and sm.active and s.active and o.active
    ),
    'networkOwners', (
      select count(distinct om.user_id) from public.organization_memberships om
      join public.organizations o on o.id = om.organization_id
      where om.role = 'network_owner' and om.active and o.active
    )
  );
end;
$$;
