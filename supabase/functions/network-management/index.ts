import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type Payload = { action: 'invite_store_manager'; storeId: string; managerName: string; managerEmail: string };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return reply({ error: 'Método não permitido.' }, 405);
  try {
    const authorization = request.headers.get('Authorization');
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!authorization || !url || !anonKey || !serviceRoleKey) throw new Error('A função não está configurada corretamente.');

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return reply({ error: 'Sua sessão expirou. Entre novamente.' }, 401);
    const payload = await request.json() as Payload;
    if (payload.action !== 'invite_store_manager' || !payload.storeId || !String(payload.managerName ?? '').trim() || !/^\S+@\S+\.\S+$/.test(String(payload.managerEmail ?? '').trim())) return reply({ error: 'Confira os dados do gerente.' }, 400);

    const adminClient = createClient(url, serviceRoleKey);
    const { data: store, error: storeError } = await adminClient.from('stores').select('id, name, organization_id, organizations (active)').eq('id', payload.storeId).single();
    if (storeError || !store || !(store.organizations as { active?: boolean } | null)?.active) return reply({ error: 'A filial não está disponível.' }, 400);

    const { data: membership } = await adminClient.from('organization_memberships').select('role').eq('organization_id', store.organization_id).eq('user_id', user.id).eq('active', true).in('role', ['network_owner', 'network_admin']).maybeSingle();
    if (!membership) return reply({ error: 'Somente o responsável da rede pode convidar gerentes de filial.' }, 403);

    const email = String(payload.managerEmail).trim().toLowerCase();
    const redirectTo = Deno.env.get('SITE_URL') || 'https://farmaescala-3bdb5.web.app';
    const { data: invitation, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, { data: { full_name: String(payload.managerName).trim(), must_set_password: true }, redirectTo });
    if (inviteError || !invitation.user) throw new Error(inviteError?.message || 'Não foi possível criar o convite.');

    const invitedUser = invitation.user;
    const { error: invitationFlagError } = await adminClient.auth.admin.updateUserById(invitedUser.id, { app_metadata: { ...invitedUser.app_metadata, invitation_pending: true, invitation_completed: false } });
    if (invitationFlagError) throw new Error('Não foi possível preparar o acesso do gerente.');
    await adminClient.from('profiles').upsert({ id: invitedUser.id, email, full_name: String(payload.managerName).trim() }, { onConflict: 'id' });
    const { error: storeMembershipError } = await adminClient.from('store_memberships').upsert({ store_id: store.id, user_id: invitedUser.id, role: 'store_manager', active: true }, { onConflict: 'store_id,user_id' });
    if (storeMembershipError) throw new Error('Não foi possível vincular o gerente à filial.');
    // A configuração inicial só termina depois que a primeira filial tem gerente.
    const { error: setupError } = await adminClient.from('organizations').update({ initial_setup_completed_at: new Date().toISOString() }).eq('id', store.organization_id).is('initial_setup_completed_at', null);
    if (setupError) throw new Error('O gerente foi vinculado, mas não foi possível concluir a configuração da rede.');
    await adminClient.from('platform_invites').insert({ organization_id: store.organization_id, invited_user_id: invitedUser.id, email, role: 'store_manager', invited_by: user.id });
    await adminClient.from('audit_logs').insert({ organization_id: store.organization_id, store_id: store.id, actor_id: user.id, action: 'store_manager_invited', entity_type: 'store', entity_id: store.id, after_data: { manager_email: email } });
    return reply({ store: { id: store.id, name: store.name }, email });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : 'Não foi possível enviar o convite.' }, 400);
  }
});
