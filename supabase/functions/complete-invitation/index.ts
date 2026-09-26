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
    if (userError || !user) return Response.json({ error: 'Sua sessão expirou. Abra novamente o convite.' }, { status: 401, headers: corsHeaders });
    const { data: passwordReady, error: readinessError } = await userClient.rpc('is_account_ready');
    if (readinessError || !passwordReady) return Response.json({ error: 'Defina sua senha antes de concluir o convite.' }, { status: 403, headers: corsHeaders });
    if (user.app_metadata?.invitation_completed) return Response.json({ ok: true }, { headers: corsHeaders });

    const adminClient = createClient(url, serviceRoleKey);
    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, invitation_pending: false, invitation_completed: true },
    });
    if (updateError) throw updateError;
    await adminClient.from('platform_invites').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('invited_user_id', user.id).eq('status', 'pending');
    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível concluir o convite.' }, { status: 400, headers: corsHeaders });
  }
});
