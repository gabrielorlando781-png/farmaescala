# Publicar o FarmaEscala gratuitamente no Firebase

O Firebase Hosting entrega somente o frontend. A IA permanece protegida nas Edge Functions do Supabase.

## 1. Criar o projeto Firebase gratuito

1. Entre em https://console.firebase.google.com/ e clique em **Adicionar projeto**.
2. Crie o projeto sem ativar cobrança. O plano Spark é suficiente para o Hosting.
3. O projeto do FarmaEscala já está vinculado ao ID `farmaescala-3bdb5`.

## 2. Preparar o Supabase

1. Aplique a migração `supabase/migrations/20260925010000_limit_ai_requests.sql` no SQL Editor.
2. No PowerShell, dentro desta pasta, execute:

   ```powershell
   npx supabase login
   npx supabase functions deploy ai-chat --project-ref fpahpgrishxuxbopodpg
   npx supabase functions deploy ai-transcribe --project-ref fpahpgrishxuxbopodpg
   ```

3. No Supabase, abra **Edge Functions > Secrets** e salve `GEMINI_API_KEY` com sua chave do Gemini.

## 3. Preparar o frontend

1. Crie localmente um arquivo chamado `.env.local` na raiz do projeto:

   ```env
   VITE_SUPABASE_URL="https://fpahpgrishxuxbopodpg.supabase.co"
   VITE_SUPABASE_PUBLISHABLE_KEY="COLE_A_CHAVE_PUBLISHABLE_DO_SUPABASE"
   ```

2. Não adicione esse arquivo ao Git. A chave publishable pode aparecer no navegador; a segurança está no RLS. A chave Gemini não deve estar nesse arquivo.

## 4. Publicar o site

No PowerShell, dentro da pasta do projeto:

```powershell
npx firebase-tools login
npm run deploy:firebase
```

Ao final, o Firebase exibirá a URL `https://farmaescala-3bdb5.web.app`.

## 5. Liberar login por e-mail

No Supabase, abra **Authentication > URL Configuration** e inclua essa URL em **Site URL** e **Redirect URLs**. Inclua também `http://localhost:5173` para desenvolvimento.
