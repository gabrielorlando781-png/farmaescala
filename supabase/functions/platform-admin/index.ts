import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type CreateInvitationPayload = {
  action: 'create_network_invitation';
  organization: { name: string; slug: string; ownerName: string; ownerEmail: string };
};

const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Método não permitido.' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!authorization || !url || !anonKey || !serviceRoleKey) throw new Error('A função de administração não está configurada corretamente.');

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return response({ error: 'Sua sessão expirou. Entre novamente.' }, 401);

    const { data: profile, error: profileError } = await userClient.from('profiles').select('is_platform_admin').eq('id', user.id).maybeSingle();
    if (profileError || !profile?.is_platform_admin) return response({ error: 'Apenas o administrador da plataforma pode criar redes.' }, 403);

    const payload = await request.json() as CreateInvitationPayload;
    if (payload.action !== 'create_network_invitation') return response({ error: 'Ação inválida.' }, 400);
    const { name, slug, ownerName, ownerEmail } = payload.organization ?? {};
    const normalizedSlug = String(slug ?? '').trim().toLowerCase();
    const email = String(ownerEmail ?? '').trim().toLowerCase();
    if (!String(name ?? '').trim() || !String(ownerName ?? '').trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug) || !/^\S+@\S+\.\S+$/.test(email)) {
      return response({ error: 'Confira o nome, identificador e e-mail do responsável.' }, 400);
    }

    const adminClient = createClient(url, serviceRoleKey);
    const { data: existingOrganization } = await adminClient.from('organizations').select('id').eq('slug', normalizedSlug).maybeSingle();
    if (existingOrganization) return response({ error: 'Esse identificador de rede já está em uso.' }, 409);

    const redirectTo = Deno.env.get('SITE_URL') || 'https://farmaescala-3bdb5.web.app';
    const { data: invitation, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: String(ownerName).trim(), must_set_password: true }, redirectTo,
    });
    if (inviteError || !invitation.user) throw new Error(inviteError?.message || 'Não foi possível criar o convite.');

    const invitedUser = invitation.user;
    const { error: invitationFlagError } = await adminClient.auth.admin.updateUserById(invitedUser.id, {
      app_metadata: { ...invitedUser.app_metadata, invitation_pending: true },
    });
    if (invitationFlagError) throw new Error('Não foi possível preparar o acesso inicial do responsável.');
    const { error: profileUpsertError } = await adminClient.from('profiles').upsert({ id: invitedUser.id, email, full_name: String(ownerName).trim() }, { onConflict: 'id' });
    if (profileUpsertError) throw new Error('Não foi possível preparar o perfil do responsável.');

    const { data: organization, error: organizationError } = await adminClient.from('organizations').insert({ name: String(name).trim(), slug: normalizedSlug }).select('id, name, slug').single();
    if (organizationError || !organization) throw new Error(organizationError?.message || 'Não foi possível criar a rede.');

    const { error: membershipError } = await adminClient.from('organization_memberships').insert({ organization_id: organization.id, user_id: invitedUser.id, role: 'network_owner' });
    if (membershipError) {
      await adminClient.from('organizations').delete().eq('id', organization.id);
      throw new Error('Não foi possível vincular o responsável à rede.');
    }

    await adminClient.from('platform_invites').insert({ organization_id: organization.id, invited_user_id: invitedUser.id, email, role: 'network_owner', invited_by: user.id });
    await adminClient.from('audit_logs').insert({ organization_id: organization.id, actor_id: user.id, action: 'organization_invited', entity_type: 'organization', entity_id: organization.id, after_data: { owner_email: email } });
    return response({ organization });
  } catch (error) {
    console.error(error);
    return response({ error: error instanceof Error ? error.message : 'Não foi possível concluir o convite.' }, 400);
  }
});
