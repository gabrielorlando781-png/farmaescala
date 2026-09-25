-- A partir desta migração, somente a Edge Function protegida pode criar redes.
revoke execute on function public.create_organization(text, text, text, text) from authenticated;

create table public.platform_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  invited_user_id uuid references public.profiles (id) on delete set null,
  email text not null,
  role public.app_role not null check (role in ('network_owner', 'network_admin', 'regional_manager', 'store_manager')),
  invited_by uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index platform_invites_organization_id_idx on public.platform_invites (organization_id);
create index platform_invites_email_idx on public.platform_invites (email);

alter table public.platform_invites enable row level security;
create policy "platform_invites_select_platform_admin" on public.platform_invites
for select to authenticated using (public.is_platform_admin());
