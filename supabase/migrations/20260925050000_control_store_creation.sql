-- Somente o administrador da plataforma libera a expansão de uma rede.
alter table public.organizations
add column if not exists store_creation_enabled boolean not null default false;

create or replace function public.can_create_store(target_organization_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.organizations o
    join public.organization_memberships om on om.organization_id = o.id
    where o.id = target_organization_id
      and o.active = true
      and o.store_creation_enabled = true
      and om.user_id = auth.uid()
      and om.active = true
      and om.role in ('network_owner', 'network_admin')
  );
$$;

-- A política anterior permitia que administradores de rede criassem filiais
-- automaticamente. Agora INSERT exige a liberação explícita da plataforma.
drop policy if exists "stores_manage_admin" on public.stores;

create policy "stores_insert_when_platform_released" on public.stores
for insert to authenticated
with check (public.can_create_store(organization_id));

create policy "stores_update_when_network_admin" on public.stores
for update to authenticated
using (public.can_manage_store(id))
with check (public.can_manage_store(id));

create policy "stores_delete_when_network_admin" on public.stores
for delete to authenticated
using (public.can_manage_store(id));
