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
- A chave `GEMINI_API_KEY` deve ficar apenas nos **Edge Function Secrets** do Supabase.
- Nunca desative as políticas RLS para "fazer funcionar"; ajuste a migração ou a API quando uma operação for negada.

## Login

1. Em **Authentication > URL Configuration**, inclua a URL do Firebase (por exemplo, `https://SEU_PROJETO.web.app`) em **Site URL** e **Redirect URLs**. Durante desenvolvimento, inclua também `http://localhost:5173`.
2. Em **Authentication > Providers > Email**, mantenha Email habilitado. Para o piloto, a confirmação de e-mail pode ficar habilitada.
3. Em **Project Settings > API**, copie a chave **Publishable**.
4. No computador usado para publicar o Firebase, crie um arquivo `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Esses valores são públicos e necessários durante a compilação do frontend.

## IA segura com Edge Functions

1. Aplique também a migração `migrations/20260925010000_limit_ai_requests.sql` no **SQL Editor**. Ela limita a IA a 20 solicitações por usuário por dia.
2. Instale/autentique o Supabase CLI e publique as funções:

   ```powershell
   npx supabase login
   npx supabase functions deploy ai-chat --project-ref fpahpgrishxuxbopodpg
   npx supabase functions deploy ai-transcribe --project-ref fpahpgrishxuxbopodpg
   ```

3. No painel do Supabase, abra **Edge Functions > Secrets** e crie `GEMINI_API_KEY` com a sua chave do Gemini. Nunca envie essa chave ao GitHub ou ao frontend.
