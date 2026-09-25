-- Execute UMA vez no SQL Editor do Supabase, substituindo pelo e-mail da sua conta.
-- Isso concede o painel exclusivo de administrador da plataforma a você.
update public.profiles
set is_platform_admin = true
where email = 'SEU_EMAIL_DE_LOGIN';

-- Confira o resultado: deve aparecer uma linha com is_platform_admin = true.
select email, is_platform_admin
from public.profiles
where email = 'SEU_EMAIL_DE_LOGIN';
