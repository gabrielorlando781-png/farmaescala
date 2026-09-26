-- A primeira filial está incluída na criação da rede. A expansão continua
-- sujeita à permissão store_creation_enabled da política existente.
alter table public.organizations
add column if not exists initial_setup_completed_at timestamptz;

-- Redes já operando não devem ser interrompidas por este novo onboarding.
update public.organizations o
set initial_setup_completed_at = now()
where initial_setup_completed_at is null
  and exists (select 1 from public.stores s where s.organization_id = o.id);

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
      and o.initial_setup_completed_at is not null
      and o.store_creation_enabled = true
      and om.user_id = auth.uid()
      and om.active = true
      and om.role in ('network_owner', 'network_admin')
  );
$$;

create or replace function public.create_initial_store(
  target_organization_id uuid,
  store_name text,
  store_code text,
  store_city text default '',
  store_state text default ''
)
returns public.stores
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization public.organizations;
  created_store public.stores;
  normalized_name text := btrim(coalesce(store_name, ''));
  normalized_code text := upper(btrim(coalesce(store_code, '')));
  normalized_state text := upper(btrim(coalesce(store_state, '')));
begin
  if auth.uid() is null then
    raise exception 'Entre novamente para cadastrar a filial.';
  end if;

  if normalized_name = '' or normalized_code = '' then
    raise exception 'Informe o nome e o código da primeira filial.';
  end if;
  if normalized_state <> '' and normalized_state !~ '^[A-Z]{2}$' then
    raise exception 'Informe uma UF válida com duas letras.';
  end if;

  -- O bloqueio da rede serializa tentativas simultâneas de criar a primeira
  -- filial; duas requisições não podem aproveitar a mesma vaga gratuita.
  select * into target_organization
  from public.organizations
  where id = target_organization_id
  for update;

  if not found or not target_organization.active then
    raise exception 'A rede não está disponível.';
  end if;
  if not exists (
    select 1 from public.organization_memberships
    where organization_id = target_organization_id
      and user_id = auth.uid()
      and active = true
      and role in ('network_owner', 'network_admin')
  ) then
    raise exception 'Somente o responsável pela rede pode cadastrar a primeira filial.';
  end if;
  if exists (select 1 from public.stores where organization_id = target_organization_id) then
    raise exception 'Esta rede já possui uma filial. Solicite a liberação para criar outra.';
  end if;

  insert into public.stores (organization_id, name, code, address)
  values (
    target_organization_id,
    normalized_name,
    normalized_code,
    jsonb_build_object('city', btrim(coalesce(store_city, '')), 'state', normalized_state)
  ) returning * into created_store;

  insert into public.audit_logs (organization_id, store_id, actor_id, action, entity_type, entity_id, after_data)
  values (target_organization_id, created_store.id, auth.uid(), 'initial_store_created', 'store', created_store.id,
    jsonb_build_object('name', created_store.name, 'code', created_store.code));

  return created_store;
end;
$$;

revoke all on function public.create_initial_store(uuid, text, text, text, text) from public, anon;
grant execute on function public.create_initial_store(uuid, text, text, text, text) to authenticated;
