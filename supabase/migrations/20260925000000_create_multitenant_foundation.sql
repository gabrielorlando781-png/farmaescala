-- Fundação multiempresa do FarmaEscala.
-- Aplique esta migração no SQL Editor do projeto Supabase antes de conectar o app.

create extension if not exists pgcrypto;

create type public.app_role as enum (
  'network_owner',
  'network_admin',
  'regional_manager',
  'store_manager',
  'pharmacist',
  'employee',
  'auditor'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  legal_name text,
  cnpj text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code text not null,
  name text not null,
  legal_name text,
  cnpj text,
  timezone text not null default 'America/Sao_Paulo',
  address jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null check (role in ('network_owner', 'network_admin', 'regional_manager', 'auditor')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.store_memberships (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null check (role in ('store_manager', 'pharmacist', 'employee', 'auditor')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, user_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.stores (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index stores_organization_id_idx on public.stores (organization_id);
create index organization_memberships_user_id_idx on public.organization_memberships (user_id);
create index store_memberships_user_id_idx on public.store_memberships (user_id);
create index audit_logs_organization_created_at_idx on public.audit_logs (organization_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger organizations_set_updated_at before update on public.organizations
for each row execute function public.set_updated_at();
create trigger stores_set_updated_at before update on public.stores
for each row execute function public.set_updated_at();
create trigger organization_memberships_set_updated_at before update on public.organization_memberships
for each row execute function public.set_updated_at();
create trigger store_memberships_set_updated_at before update on public.store_memberships
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Funções SECURITY DEFINER evitam recursão de RLS nas tabelas de associação.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_platform_admin = true
  );
$$;

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.organization_memberships
    where organization_id = target_organization_id
      and user_id = auth.uid()
      and active = true
  ) or exists (
    select 1
    from public.store_memberships sm
    join public.stores s on s.id = sm.store_id
    where s.organization_id = target_organization_id
      and sm.user_id = auth.uid()
      and sm.active = true
  );
$$;

create or replace function public.has_organization_role(target_organization_id uuid, allowed_roles public.app_role[])
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.organization_memberships
    where organization_id = target_organization_id
      and user_id = auth.uid()
      and active = true
      and role = any (allowed_roles)
  );
$$;

create or replace function public.is_store_member(target_store_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.store_memberships
    where store_id = target_store_id
      and user_id = auth.uid()
      and active = true
  ) or exists (
    select 1
    from public.stores s
    join public.organization_memberships om on om.organization_id = s.organization_id
    where s.id = target_store_id
      and om.user_id = auth.uid()
      and om.active = true
  );
$$;

create or replace function public.can_manage_store(target_store_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.stores s
    where s.id = target_store_id
      and public.has_organization_role(
        s.organization_id,
        array['network_owner', 'network_admin', 'regional_manager']::public.app_role[]
      )
  );
$$;

create or replace function public.create_organization(
  organization_name text,
  organization_slug text,
  organization_legal_name text default null,
  organization_cnpj text default null
)
returns public.organizations
language plpgsql
security definer set search_path = public
as $$
declare
  created_organization public.organizations;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  -- Também cobre usuários que já existiam antes da instalação do gatilho.
  insert into public.profiles (id, email)
  select id, email from auth.users where id = auth.uid()
  on conflict (id) do nothing;

  insert into public.organizations (name, slug, legal_name, cnpj)
  values (organization_name, organization_slug, organization_legal_name, organization_cnpj)
  returning * into created_organization;

  insert into public.organization_memberships (organization_id, user_id, role)
  values (created_organization.id, auth.uid(), 'network_owner');

  return created_organization;
end;
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.stores enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.store_memberships enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_own" on public.profiles
for select to authenticated using (id = auth.uid() or public.is_platform_admin());
create policy "profiles_update_own" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "organizations_select_member" on public.organizations
for select to authenticated using (public.is_organization_member(id));
create policy "organizations_update_admin" on public.organizations
for update to authenticated
using (public.has_organization_role(id, array['network_owner', 'network_admin']::public.app_role[]))
with check (public.has_organization_role(id, array['network_owner', 'network_admin']::public.app_role[]));

create policy "stores_select_member" on public.stores
for select to authenticated using (public.is_organization_member(organization_id));
create policy "stores_manage_admin" on public.stores
for all to authenticated
using (public.has_organization_role(organization_id, array['network_owner', 'network_admin', 'regional_manager']::public.app_role[]))
with check (public.has_organization_role(organization_id, array['network_owner', 'network_admin', 'regional_manager']::public.app_role[]));

create policy "organization_memberships_select_member" on public.organization_memberships
for select to authenticated using (public.is_organization_member(organization_id));
create policy "organization_memberships_manage_admin" on public.organization_memberships
for all to authenticated
using (public.has_organization_role(organization_id, array['network_owner', 'network_admin']::public.app_role[]))
with check (public.has_organization_role(organization_id, array['network_owner', 'network_admin']::public.app_role[]));

create policy "store_memberships_select_member" on public.store_memberships
for select to authenticated using (public.is_store_member(store_id));
create policy "store_memberships_manage_admin" on public.store_memberships
for all to authenticated
using (public.can_manage_store(store_id))
with check (public.can_manage_store(store_id));

create policy "audit_logs_select_member" on public.audit_logs
for select to authenticated using (public.is_organization_member(organization_id));

grant execute on function public.create_organization(text, text, text, text) to authenticated;

-- RLS controla as linhas; este privilégio por coluna impede que um usuário
-- promova a própria conta alterando is_platform_admin no cliente.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;
