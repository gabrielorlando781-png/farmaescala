-- O link de convite autentica temporariamente o usuário, mas não lhe dá
-- acesso aos dados antes de ele escolher uma senha própria.
alter table public.profiles
  add column if not exists password_setup_completed_at timestamptz;

-- Preserva o acesso de contas que já concluíram o processo antes desta regra.
update public.profiles p
set password_setup_completed_at = now()
from auth.users u
where p.id = u.id
  and p.password_setup_completed_at is null
  and (u.invited_at is null or u.raw_app_meta_data ->> 'invitation_completed' = 'true' or p.is_platform_admin);

create or replace function public.mark_invite_password_setup()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.email_confirmed_at is not null
    and new.encrypted_password is distinct from old.encrypted_password
    and nullif(new.encrypted_password, '') is not null
  then
    update public.profiles
      set password_setup_completed_at = now()
      where id = new.id and password_setup_completed_at is null;
  end if;
  return new;
end;
$$;

create trigger mark_invite_password_setup
after update of encrypted_password on auth.users
for each row execute function public.mark_invite_password_setup();

create or replace function public.is_account_ready()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.password_setup_completed_at is not null
  );
$$;

revoke execute on function public.is_account_ready() from public, anon;
grant execute on function public.is_account_ready() to authenticated;

create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_account_ready() and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_platform_admin
  );
$$;

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_account_ready() and (
    public.is_platform_admin() or exists (
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
    )
  );
$$;

create or replace function public.has_organization_role(target_organization_id uuid, allowed_roles public.app_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_account_ready() and (
    public.is_platform_admin() or exists (
      select 1 from public.organization_memberships om
      join public.organizations o on o.id = om.organization_id
      where om.organization_id = target_organization_id
        and om.user_id = auth.uid() and om.active and o.active
        and om.role = any (allowed_roles)
    )
  );
$$;

create or replace function public.is_store_member(target_store_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_account_ready() and (
    public.is_platform_admin() or exists (
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
    )
  );
$$;

create or replace function public.can_manage_store(target_store_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_account_ready() and (
    public.is_platform_admin() or exists (
      select 1 from public.stores s
      join public.organizations o on o.id = s.organization_id
      join public.organization_memberships om on om.organization_id = o.id
      where s.id = target_store_id and o.active
        and om.user_id = auth.uid() and om.active
        and om.role in ('network_owner', 'network_admin')
    )
  );
$$;

create or replace function public.can_manage_store_operations(target_store_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_account_ready() and (
    public.is_platform_admin() or exists (
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
    )
  );
$$;

create or replace function public.can_create_store(target_organization_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_account_ready() and (
    public.is_platform_admin() or exists (
      select 1 from public.organizations o
      join public.organization_memberships om on om.organization_id = o.id
      where o.id = target_organization_id and o.active
        and o.initial_setup_completed_at is not null
        and o.store_creation_enabled
        and om.user_id = auth.uid() and om.active
        and om.role in ('network_owner', 'network_admin')
    )
  );
$$;

-- Mesmo funções SECURITY DEFINER acessíveis ao cliente devem respeitar o
-- estado da conta, já que suas consultas internas ignoram RLS.
create or replace function public.assert_account_ready()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_account_ready() then
    raise exception 'Defina sua senha antes de acessar a plataforma.';
  end if;
end;
$$;
revoke execute on function public.assert_account_ready() from public, anon;
grant execute on function public.assert_account_ready() to authenticated;

create or replace function public.require_ready_for_store_creation()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_account_ready() then
    raise exception 'Defina sua senha antes de cadastrar filiais.';
  end if;
  return new;
end;
$$;

create trigger require_ready_for_store_creation
before insert on public.stores
for each row execute function public.require_ready_for_store_creation();

create or replace function public.consume_ai_request_v2()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  usage_day date := (now() at time zone 'America/Sao_Paulo')::date;
  used_count integer;
  accepted boolean := false;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  perform public.assert_account_ready();
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
