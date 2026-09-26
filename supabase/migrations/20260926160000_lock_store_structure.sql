-- A criação de filiais permanece permitida somente após liberação da
-- plataforma. Alteração de organização e exclusão por API direta não fazem
-- parte do fluxo do produto e poderiam mover ou apagar dados em cascata.
revoke update, delete on public.stores from public, authenticated;
