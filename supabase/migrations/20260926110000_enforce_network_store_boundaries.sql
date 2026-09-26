-- O administrador da plataforma é a única exceção: mantém visibilidade para
-- suporte e reativação. Uma rede suspensa bloqueia seus próprios usuários.
create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.organization_memberships om
    join public.organizations o on o.id = om.organization_id
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid() and om.active and o.active
  ) or exists (
    select 1 from public.store_memberships sm
    join public.stores s on s.id = sm.store_id
    join public.organizations o on o.id = s.organization_id
    where s.organization_id = target_organization_id
      and sm.user_id = auth.uid() and sm.active and s.active and o.active
  );
$$;

-- Gerente de filial só acessa a filial atribuída. Acesso a todas as filiais
-- da rede exige papel de responsável ou administrador daquela rede.
create or replace function public.is_store_member(target_store_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.stores s
    join public.organizations o on o.id = s.organization_id
    where s.id = target_store_id and s.active and o.active
      and (
        exists (
          select 1 from public.store_memberships sm
          where sm.store_id = s.id and sm.user_id = auth.uid() and sm.active
        ) or exists (
          select 1 from public.organization_memberships om
          where om.organization_id = s.organization_id
            and om.user_id = auth.uid() and om.active
            and om.role in ('network_owner', 'network_admin')
        )
      )
  );
$$;

create or replace function public.can_manage_store(target_store_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.stores s
    join public.organizations o on o.id = s.organization_id
    join public.organization_memberships om on om.organization_id = o.id
    where s.id = target_store_id and o.active
      and om.user_id = auth.uid() and om.active
      and om.role in ('network_owner', 'network_admin')
  );
$$;

create or replace function public.can_manage_store_operations(target_store_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.stores s
    join public.organizations o on o.id = s.organization_id
    where s.id = target_store_id and s.active and o.active
      and (
        exists (
          select 1 from public.organization_memberships om
          where om.organization_id = o.id and om.user_id = auth.uid()
            and om.active and om.role in ('network_owner', 'network_admin')
        ) or exists (
          select 1 from public.store_memberships sm
          where sm.store_id = s.id and sm.user_id = auth.uid()
            and sm.active and sm.role = 'store_manager'
        )
      )
  );
$$;

-- A antiga política por rede deixava gerentes enxergarem outras filiais.
drop policy if exists "stores_select_member" on public.stores;
create policy "stores_select_scoped" on public.stores
for select to authenticated
using (
  public.has_organization_role(organization_id, array['network_owner', 'network_admin']::public.app_role[])
  or public.is_store_member(id)
);

drop policy if exists "organization_memberships_select_member" on public.organization_memberships;
create policy "organization_memberships_select_network_admin" on public.organization_memberships
for select to authenticated
using (public.has_organization_role(organization_id, array['network_owner', 'network_admin']::public.app_role[]));

drop policy if exists "audit_logs_select_member" on public.audit_logs;
create policy "audit_logs_select_network_admin" on public.audit_logs
for select to authenticated
using (public.has_organization_role(organization_id, array['network_owner', 'network_admin']::public.app_role[]));

-- O dono da rede não pode se reativar nem liberar filiais por chamada direta
-- à API. Essas ações continuam exclusivas da Edge Function da plataforma.
revoke update on public.organizations from authenticated;
grant update (name, legal_name, cnpj) on public.organizations to authenticated;

-- Revogar também de PUBLIC: apenas revogar de authenticated não basta.
revoke execute on function public.create_organization(text, text, text, text)
from public, anon, authenticated;
