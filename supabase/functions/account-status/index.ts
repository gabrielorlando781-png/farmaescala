import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return Response.json({ error: 'Método não permitido.' }, { status: 405, headers: corsHeaders });
  try {
    const authorization = request.headers.get('Authorization');
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!authorization || !url || !anonKey || !serviceRoleKey) throw new Error('A função não está configurada corretamente.');
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return Response.json({ error: 'Sua sessão expirou.' }, { status: 401, headers: corsHeaders });
    const adminClient = createClient(url, serviceRoleKey);
    const { data, error } = await adminClient.from('organization_memberships').select('organizations (id, name, slug, active)').eq('user_id', user.id).eq('active', true).limit(1).maybeSingle();
    if (error) throw error;
    return Response.json({ organization: data?.organizations ?? null }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível verificar seu acesso.' }, { status: 400, headers: corsHeaders });
  }
});
