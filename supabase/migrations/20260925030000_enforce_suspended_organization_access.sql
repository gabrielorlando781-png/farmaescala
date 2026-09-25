-- Uma rede suspensa perde acesso às tabelas protegidas por RLS.
-- O administrador da plataforma continua podendo administrá-la e reativá-la.
create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.organization_memberships om
    join public.organizations o on o.id = om.organization_id
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
      and om.active = true
      and o.active = true
  ) or exists (
    select 1
    from public.store_memberships sm
    join public.stores s on s.id = sm.store_id
    join public.organizations o on o.id = s.organization_id
    where s.organization_id = target_organization_id
      and sm.user_id = auth.uid()
      and sm.active = true
      and o.active = true
  );
$$;

create or replace function public.has_organization_role(target_organization_id uuid, allowed_roles public.app_role[])
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.organization_memberships om
    join public.organizations o on o.id = om.organization_id
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
      and om.active = true
      and o.active = true
      and om.role = any (allowed_roles)
  );
$$;

create or replace function public.is_store_member(target_store_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.store_memberships sm
    join public.stores s on s.id = sm.store_id
    join public.organizations o on o.id = s.organization_id
    where sm.store_id = target_store_id
      and sm.user_id = auth.uid()
      and sm.active = true
      and o.active = true
  ) or exists (
    select 1
    from public.stores s
    join public.organizations o on o.id = s.organization_id
    join public.organization_memberships om on om.organization_id = s.organization_id
    where s.id = target_store_id
      and om.user_id = auth.uid()
      and om.active = true
      and o.active = true
  );
$$;
