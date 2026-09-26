-- O Auth insere o usuário antes de preencher invited_at no mesmo fluxo de convite.
-- A verificação precisa ocorrer no fim da transação, após o envio do convite.
drop trigger if exists block_non_invited_auth_user on auth.users;

create or replace function public.block_non_invited_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from auth.users u
    where u.id = new.id
      and u.invited_at is not null
  ) then
    raise exception 'Cadastro público desativado. Solicite um convite ao administrador do FarmaEscala.';
  end if;
  return null;
end;
$$;

create constraint trigger block_non_invited_auth_user
after insert on auth.users
deferrable initially deferred
for each row execute function public.block_non_invited_auth_user();
