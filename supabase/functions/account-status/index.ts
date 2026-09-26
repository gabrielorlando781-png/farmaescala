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
    const { data: passwordReady, error: readinessError } = await userClient.rpc('is_account_ready');
    if (readinessError || !passwordReady) return Response.json({ error: 'Defina sua senha antes de acessar a plataforma.' }, { status: 403, headers: corsHeaders });
    const adminClient = createClient(url, serviceRoleKey);
    const { data: organizationMembership, error: organizationError } = await adminClient.from('organization_memberships').select('role, organizations (id, name, slug, active, store_creation_enabled, initial_setup_completed_at)').eq('user_id', user.id).eq('active', true).limit(1).maybeSingle();
    if (organizationError) throw organizationError;
    if (organizationMembership?.organizations && ['network_owner', 'network_admin'].includes(organizationMembership.role)) {
      const organization = organizationMembership.organizations as { id: string; active: boolean };
      if (!organization.active) return Response.json({ organization, membershipRole: organizationMembership.role, stores: [] }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data: stores, error: storesError } = await adminClient.from('stores').select('id, name, code, active').eq('organization_id', organization.id).eq('active', true).order('name');
      if (storesError) throw storesError;
      return Response.json({ organization, membershipRole: organizationMembership.role, stores: stores ?? [] }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Um gerente de filial não participa da rede inteira; ele entra por store_memberships.
    const { data: storeMembership, error: storeError } = await adminClient.from('store_memberships').select('role, stores (id, name, code, active, organization_id, organizations (id, name, slug, active, store_creation_enabled, initial_setup_completed_at))').eq('user_id', user.id).eq('active', true).limit(1).maybeSingle();
    if (storeError) throw storeError;
    const store = storeMembership?.stores as { id: string; name: string; code: string; active: boolean; organizations?: { active?: boolean } } | null;
    const storeAvailable = Boolean(store?.active && store.organizations?.active);
    return Response.json({ organization: store?.organizations ?? organizationMembership?.organizations ?? null, membershipRole: storeMembership?.role ?? organizationMembership?.role ?? null, stores: storeAvailable && store ? [{ id: store.id, name: store.name, code: store.code, active: true }] : [] }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível verificar seu acesso.' }, { status: 400, headers: corsHeaders });
  }
});
