-- Defesa no banco: somente contas geradas pelo fluxo de convite podem ser criadas.
-- Mesmo que uma tela antiga fique em cache ou alguém tente chamar signUp diretamente,
-- a inserção em auth.users é recusada.
create or replace function public.block_non_invited_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.invited_at is null then
    raise exception 'Cadastro público desativado. Solicite um convite ao administrador do FarmaEscala.';
  end if;
  return new;
end;
$$;

drop trigger if exists block_non_invited_auth_user on auth.users;
create trigger block_non_invited_auth_user
before insert on auth.users
for each row execute function public.block_non_invited_auth_user();
