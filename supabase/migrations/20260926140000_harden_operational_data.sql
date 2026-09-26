-- A filial não pode transferir um registro para outra filial nem falsificar a autoria.
create or replace function public.protect_store_operational_data()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.store_id is distinct from old.store_id then
    raise exception 'Não é permitido trocar a filial dos dados operacionais.';
  end if;
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger store_operational_data_protect
before insert or update on public.store_operational_data
for each row execute function public.protect_store_operational_data();

alter table public.store_operational_data
  add constraint store_operational_data_valid_shapes check (
    jsonb_typeof(employees) = 'array'
    and jsonb_typeof(shifts) = 'array'
    and jsonb_typeof(settings) = 'object'
    and jsonb_typeof(schedules) = 'object'
  ),
  add constraint store_operational_data_max_size check (
    octet_length(employees::text) <= 1048576
    and octet_length(shifts::text) <= 262144
    and octet_length(settings::text) <= 262144
    and octet_length(schedules::text) <= 4194304
  );

-- A auditoria e o cadastro de associações passam somente pelas funções
-- administrativas, que verificam o papel antes de usar service_role.
revoke insert, update, delete on public.organization_memberships from public, authenticated;
revoke insert, update, delete on public.store_memberships from public, authenticated;
revoke insert, update, delete on public.audit_logs from public, authenticated;
