# Banco Supabase do FarmaEscala

Projeto: `fpahpgrishxuxbopodpg`

## Aplicar a fundação multiempresa

1. Abra o projeto no [Supabase Dashboard](https://supabase.com/dashboard/project/fpahpgrishxuxbopodpg).
2. Acesse **SQL Editor** e clique em **New query**.
3. Copie todo o conteúdo de `migrations/20260925000000_create_multitenant_foundation.sql`.
4. Clique em **Run**.
5. Confirme em **Table Editor** que as tabelas `profiles`, `organizations`, `stores`, `organization_memberships`, `store_memberships` e `audit_logs` foram criadas.

Essa etapa não cria usuários nem lojas. Ela apenas prepara o isolamento por rede e unidade, autenticação e auditoria.

## Segurança

- Use somente `VITE_SUPABASE_URL` e a chave publishable/anon no frontend.
- Mantenha `SUPABASE_SERVICE_ROLE_KEY` apenas no backend e nas variáveis secretas do Render.
- Nunca desative as políticas RLS para "fazer funcionar"; ajuste a migração ou a API quando uma operação for negada.
