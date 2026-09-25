<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# FarmaEscala

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` em `.env.local`.
3. Rode o app:
   `npm run dev`

## Publicação

O frontend é publicado gratuitamente no Firebase Hosting. A chave Gemini fica protegida nas Supabase Edge Functions. Siga [FIREBASE_DEPLOY.md](FIREBASE_DEPLOY.md).
