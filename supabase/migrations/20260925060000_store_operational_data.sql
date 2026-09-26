-- Dados operacionais pertencem à filial, nunca ao navegador de um usuário.
create table public.store_operational_data (
  store_id uuid primary key references public.stores (id) on delete cascade,
  employees jsonb not null default '[]'::jsonb,
  shifts jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  schedules jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger store_operational_data_set_updated_at before update on public.store_operational_data
for each row execute function public.set_updated_at();

create or replace function public.can_manage_store_operations(target_store_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.can_manage_store(target_store_id) or exists (
    select 1
    from public.store_memberships sm
    join public.stores s on s.id = sm.store_id
    join public.organizations o on o.id = s.organization_id
    where sm.store_id = target_store_id
      and sm.user_id = auth.uid()
      and sm.active = true
      and sm.role = 'store_manager'
      and o.active = true
  );
$$;

alter table public.store_operational_data enable row level security;

create policy "store_data_select_member" on public.store_operational_data
for select to authenticated using (public.is_store_member(store_id));
create policy "store_data_insert_manager" on public.store_operational_data
for insert to authenticated with check (public.can_manage_store_operations(store_id));
create policy "store_data_update_manager" on public.store_operational_data
for update to authenticated using (public.can_manage_store_operations(store_id)) with check (public.can_manage_store_operations(store_id));
