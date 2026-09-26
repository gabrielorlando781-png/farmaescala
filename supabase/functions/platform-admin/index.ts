import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type CreateInvitationPayload = {
  action: 'create_network_invitation';
  organization: { name: string; slug: string; ownerName: string; ownerEmail: string };
} | { action: 'set_organization_active'; organizationId: string; active: boolean }
  | { action: 'set_store_creation_enabled'; organizationId: string; enabled: boolean }
  | { action: 'delete_organization'; organizationId: string };

const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Em situações antigas de convite interrompido, o usuário pode existir no Auth
// sem que o perfil tenha sido criado. Só consultamos o Auth nesse caso raro.
const findAuthUserByEmail = async (adminClient: ReturnType<typeof createClient>, email: string) => {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error('Não foi possível recuperar a conta já existente.');
    const user = data.users.find((candidate) => candidate.email?.trim().toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 1000) break;
  }
  return null;
};

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

    const [{ data: profile, error: profileError }, { data: passwordReady, error: readinessError }] = await Promise.all([
      userClient.from('profiles').select('is_platform_admin').eq('id', user.id).maybeSingle(),
      userClient.rpc('is_account_ready'),
    ]);
    if (profileError || readinessError || !passwordReady || !profile?.is_platform_admin) return response({ error: 'Apenas o administrador da plataforma pode criar redes.' }, 403);

    const payload = await request.json() as CreateInvitationPayload;
    const adminClient = createClient(url, serviceRoleKey);
    if (payload.action === 'set_organization_active') {
      if (!payload.organizationId || typeof payload.active !== 'boolean') return response({ error: 'Dados da rede inválidos.' }, 400);
      const { data: organization, error: updateError } = await adminClient.from('organizations').update({ active: payload.active }).eq('id', payload.organizationId).select('id, name, slug, active').single();
      if (updateError || !organization) return response({ error: 'Não foi possível alterar o status da rede.' }, 400);
      await adminClient.from('audit_logs').insert({ organization_id: organization.id, actor_id: user.id, action: organization.active ? 'organization_activated' : 'organization_suspended', entity_type: 'organization', entity_id: organization.id, after_data: { active: organization.active } });
      return response({ organization });
    }
    if (payload.action === 'set_store_creation_enabled') {
      if (!payload.organizationId || typeof payload.enabled !== 'boolean') return response({ error: 'Dados da rede inválidos.' }, 400);
      const { data: organization, error: updateError } = await adminClient.from('organizations').update({ store_creation_enabled: payload.enabled }).eq('id', payload.organizationId).select('id, name, slug, active, store_creation_enabled').single();
      if (updateError || !organization) return response({ error: 'Não foi possível alterar a criação de filiais.' }, 400);
      await adminClient.from('audit_logs').insert({ organization_id: organization.id, actor_id: user.id, action: organization.store_creation_enabled ? 'store_creation_enabled' : 'store_creation_disabled', entity_type: 'organization', entity_id: organization.id, after_data: { store_creation_enabled: organization.store_creation_enabled } });
      return response({ organization });
    }
    if (payload.action === 'delete_organization') {
      const organizationId = String(payload.organizationId ?? '');
      if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(organizationId)) {
        return response({ error: 'Dados da rede inválidos.' }, 400);
      }

      const { data: organization, error: organizationError } = await adminClient
        .from('organizations').select('id, name').eq('id', organizationId).maybeSingle();
      if (organizationError || !organization) return response({ error: 'Rede não encontrada.' }, 404);

      const [{ data: organizationMembers, error: organizationMembersError }, { data: stores, error: storesError }] = await Promise.all([
        adminClient.from('organization_memberships').select('user_id').eq('organization_id', organizationId),
        adminClient.from('stores').select('id').eq('organization_id', organizationId),
      ]);
      if (organizationMembersError || storesError) throw new Error('Não foi possível preparar a exclusão da rede.');

      const storeIds = (stores ?? []).map((store) => store.id);
      let storeMembers: { user_id: string }[] = [];
      if (storeIds.length) {
        const { data, error } = await adminClient.from('store_memberships').select('user_id').in('store_id', storeIds);
        if (error) throw new Error('Não foi possível preparar a exclusão das filiais.');
        storeMembers = data ?? [];
      }
      const candidateUserIds = [...new Set([
        ...(organizationMembers ?? []).map((member) => member.user_id),
        ...storeMembers.map((member) => member.user_id),
      ].filter(Boolean))];

      // Cascades remove stores, memberships, invitations, schedules and every operational record tied to this network.
      const { error: deleteError } = await adminClient.from('organizations').delete().eq('id', organizationId);
      if (deleteError) throw new Error('Não foi possível excluir a rede.');

      if (!candidateUserIds.length) return response({ organization, deletedAuthUsers: 0, retainedAuthUsers: 0, failedAuthUsers: 0 });

      // An account is removed only if it no longer has any relationship to another network and is not a platform administrator.
      const [profilesResult, organizationMembershipsResult, storeMembershipsResult, pendingInvitesResult] = await Promise.all([
        adminClient.from('profiles').select('id, is_platform_admin').in('id', candidateUserIds),
        adminClient.from('organization_memberships').select('user_id').in('user_id', candidateUserIds),
        adminClient.from('store_memberships').select('user_id').in('user_id', candidateUserIds),
        adminClient.from('platform_invites').select('invited_user_id').eq('status', 'pending').in('invited_user_id', candidateUserIds),
      ]);
      if (profilesResult.error || organizationMembershipsResult.error || storeMembershipsResult.error || pendingInvitesResult.error) {
        return response({ organization, deletedAuthUsers: 0, retainedAuthUsers: candidateUserIds.length, failedAuthUsers: candidateUserIds.length, warning: 'A rede foi excluída, mas não foi possível verificar as contas para liberar os e-mails.' });
      }

      const retainedUserIds = new Set<string>([
        ...(profilesResult.data ?? []).filter((profile) => profile.is_platform_admin).map((profile) => profile.id),
        ...(organizationMembershipsResult.data ?? []).map((membership) => membership.user_id),
        ...(storeMembershipsResult.data ?? []).map((membership) => membership.user_id),
        ...(pendingInvitesResult.data ?? []).map((invitation) => invitation.invited_user_id),
      ]);
      const eligibleUserIds = candidateUserIds.filter((candidateId) => !retainedUserIds.has(candidateId));
      let deletedAuthUsers = 0;
      let failedAuthUsers = 0;
      for (const candidateId of eligibleUserIds) {
        const { error } = await adminClient.auth.admin.deleteUser(candidateId);
        if (error) failedAuthUsers += 1;
        else deletedAuthUsers += 1;
      }

      return response({ organization, deletedAuthUsers, retainedAuthUsers: retainedUserIds.size, failedAuthUsers });
    }
    if (payload.action !== 'create_network_invitation') return response({ error: 'Ação inválida.' }, 400);
    const { name, slug, ownerName, ownerEmail } = payload.organization ?? {};
    const normalizedSlug = String(slug ?? '').trim().toLowerCase();
    const email = String(ownerEmail ?? '').trim().toLowerCase();
    if (!String(name ?? '').trim() || !String(ownerName ?? '').trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug) || !/^\S+@\S+\.\S+$/.test(email)) {
      return response({ error: 'Confira o nome, identificador e e-mail do responsável.' }, 400);
    }

    const { data: existingOrganization } = await adminClient.from('organizations').select('id').eq('slug', normalizedSlug).maybeSingle();
    if (existingOrganization) return response({ error: 'Esse identificador de rede já está em uso.' }, 409);

    // Uma conta existente não precisa (nem pode) receber um segundo convite do Supabase.
    // O administrador da plataforma pode conceder a nova rede diretamente a ela.
    const { data: existingProfile, error: existingProfileError } = await adminClient
      .from('profiles').select('id').eq('email', email).maybeSingle();
    if (existingProfileError) throw new Error('Não foi possível verificar o responsável informado.');

    let ownerUserId: string;
    let invitationSent = false;
    if (existingProfile?.id) {
      ownerUserId = existingProfile.id;
    } else {
      const redirectTo = Deno.env.get('SITE_URL') || 'https://farmaescala-3bdb5.web.app';
      const { data: invitation, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { full_name: String(ownerName).trim(), must_set_password: true }, redirectTo,
      });
      if (inviteError || !invitation.user) {
        const details = inviteError?.message || '';
        if (/rate.?limit|too many|email.*limit/i.test(details)) {
          return response({ error: 'O limite de e-mails de convite do Supabase foi atingido. Isso não é limite do banco: aguarde cerca de uma hora para tentar novamente ou configure um SMTP próprio quando começar a vender o sistema.' }, 429);
        }
        if (/already|registered|exists|duplicate/i.test(details)) {
          const recoveredUser = await findAuthUserByEmail(adminClient, email);
          if (!recoveredUser) throw new Error('O e-mail já está registrado, mas a conta não pôde ser localizada para receber o acesso.');
          ownerUserId = recoveredUser.id;
          const { error: profileUpsertError } = await adminClient.from('profiles').upsert({ id: ownerUserId, email, full_name: String(ownerName).trim() }, { onConflict: 'id' });
          if (profileUpsertError) throw new Error('Não foi possível recuperar o perfil da conta existente.');
          const { error: recoveryError } = await userClient.auth.resetPasswordForEmail(email, { redirectTo });
          if (recoveryError) throw new Error('A conta já existia e recebeu acesso à rede, mas não foi possível enviar o e-mail para definir a senha. Use "Esqueci minha senha" na tela de acesso.');
          invitationSent = true;
        } else {
          throw new Error(details || 'Não foi possível criar o convite.');
        }
      } else {
        ownerUserId = invitation.user.id;
        invitationSent = true;
        const { error: invitationFlagError } = await adminClient.auth.admin.updateUserById(ownerUserId, {
          app_metadata: { ...invitation.user.app_metadata, invitation_pending: true },
        });
        if (invitationFlagError) throw new Error('Não foi possível preparar o acesso inicial do responsável.');
        const { error: profileUpsertError } = await adminClient.from('profiles').upsert({ id: ownerUserId, email, full_name: String(ownerName).trim() }, { onConflict: 'id' });
        if (profileUpsertError) throw new Error('Não foi possível preparar o perfil do responsável.');
      }
    }

    const { data: organization, error: organizationError } = await adminClient.from('organizations').insert({ name: String(name).trim(), slug: normalizedSlug }).select('id, name, slug').single();
    if (organizationError || !organization) throw new Error(organizationError?.message || 'Não foi possível criar a rede.');

    const { error: membershipError } = await adminClient.from('organization_memberships').insert({ organization_id: organization.id, user_id: ownerUserId, role: 'network_owner' });
    if (membershipError) {
      await adminClient.from('organizations').delete().eq('id', organization.id);
      throw new Error('Não foi possível vincular o responsável à rede.');
    }

    await adminClient.from('platform_invites').insert({ organization_id: organization.id, invited_user_id: ownerUserId, email, role: 'network_owner', invited_by: user.id });
    await adminClient.from('audit_logs').insert({ organization_id: organization.id, actor_id: user.id, action: 'organization_invited', entity_type: 'organization', entity_id: organization.id, after_data: { owner_email: email } });
    return response({ organization, invitationSent });
  } catch (error) {
    console.error(error);
    return response({ error: error instanceof Error ? error.message : 'Não foi possível concluir o convite.' }, 400);
  }
});
