import React, { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Building2, Mail, PauseCircle, PlayCircle, Plus, ShieldCheck, Store } from 'lucide-react';
import { supabase } from '../lib/supabase';

type ProfileContact = { full_name: string | null; email: string | null };
type Membership = { role: string; profiles: ProfileContact | ProfileContact[] | null };
type StoreRecord = { id: string; name: string; code: string; active: boolean; store_memberships: Membership[] };
type Organization = { id: string; name: string; slug: string; active: boolean; store_creation_enabled: boolean; created_at: string; stores: StoreRecord[]; organization_memberships: Membership[] };

const managerEmails = (memberships: Membership[]) => memberships
  .filter((membership) => ['network_owner', 'network_admin', 'store_manager'].includes(membership.role))
  .flatMap((membership) => Array.isArray(membership.profiles) ? membership.profiles : [membership.profiles])
  .map((profile) => profile?.email)
  .filter((email): email is string => Boolean(email));

const getFunctionErrorMessage = async (requestError: unknown, fallback: string) => {
  const context = requestError && typeof requestError === 'object' && 'context' in requestError
    ? (requestError as { context?: unknown }).context
    : undefined;
  if (context instanceof Response) {
    const body = await context.clone().json().catch(() => null) as { error?: unknown } | null;
    if (typeof body?.error === 'string' && body.error.trim()) return body.error;
  }
  return requestError instanceof Error && requestError.message ? requestError.message : fallback;
};

export const PlatformAdminPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sending, setSending] = useState(false);
  const [changingOrganizationId, setChangingOrganizationId] = useState<string | null>(null);

  const loadOrganizations = async () => {
    if (!supabase) return;
    const { data, error: listError } = await supabase.from('organizations').select('id, name, slug, active, store_creation_enabled, created_at, organization_memberships (role, profiles (full_name, email)), stores (id, name, code, active, store_memberships (role, profiles (full_name, email)))').order('created_at', { ascending: false });
    if (listError) setError('Não foi possível carregar as redes.');
    else setOrganizations((data ?? []) as unknown as Organization[]);
  };

  const changeStoreCreationPermission = async (organization: Organization) => {
    if (!supabase) return;
    const action = organization.store_creation_enabled ? 'bloquear' : 'liberar';
    if (!window.confirm(`Deseja ${action} a criação de filiais para ${organization.name}?`)) return;
    setError(''); setSuccess(''); setChangingOrganizationId(organization.id);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('platform-admin', { body: { action: 'set_store_creation_enabled', organizationId: organization.id, enabled: !organization.store_creation_enabled } });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setSuccess(`Criação de filiais ${organization.store_creation_enabled ? 'bloqueada' : 'liberada'} para ${organization.name}.`);
      await loadOrganizations();
    } catch (requestError) {
      setError(await getFunctionErrorMessage(requestError, 'Não foi possível alterar a permissão.'));
    } finally { setChangingOrganizationId(null); }
  };

  const changeOrganizationStatus = async (organization: Organization) => {
    if (!supabase) return;
    const action = organization.active ? 'suspender' : 'reativar';
    if (!window.confirm(`Deseja ${action} a rede ${organization.name}? ${organization.active ? 'Os usuários não conseguirão acessar a plataforma até a reativação.' : 'Os usuários voltarão a acessar a plataforma.'}`)) return;
    setError(''); setSuccess(''); setChangingOrganizationId(organization.id);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('platform-admin', { body: { action: 'set_organization_active', organizationId: organization.id, active: !organization.active } });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setSuccess(`Rede ${organization.name} ${organization.active ? 'suspensa' : 'reativada'} com sucesso.`);
      await loadOrganizations();
    } catch (requestError) {
      setError(await getFunctionErrorMessage(requestError, 'Não foi possível alterar o status da rede.'));
    } finally { setChangingOrganizationId(null); }
  };

  useEffect(() => { void loadOrganizations(); }, []);

  const updateName = (value: string) => {
    setName(value);
    if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) {
      setSlug(value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setError(''); setSuccess(''); setSending(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('platform-admin', {
        body: { action: 'create_network_invitation', organization: { name, slug, ownerName: adminName, ownerEmail: adminEmail } },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setSuccess(`Convite enviado para ${adminEmail}. A rede foi criada e ficará disponível quando a pessoa aceitar o convite.`);
      setName(''); setSlug(''); setAdminName(''); setAdminEmail('');
      await loadOrganizations();
    } catch (requestError) {
      setError(await getFunctionErrorMessage(requestError, 'Não foi possível criar a rede e enviar o convite.'));
    } finally { setSending(false); }
  };

  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8">
    <div className="mx-auto max-w-5xl">
      <button onClick={onClose} className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-sky-700"><ArrowLeft className="h-4 w-4" />Voltar para a escala</button>
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-7 text-white shadow-xl">
        <div className="flex items-center gap-3"><div className="rounded-2xl bg-sky-500/20 p-3"><ShieldCheck className="h-7 w-7 text-sky-300" /></div><div><p className="text-sm font-semibold text-sky-300">Acesso exclusivo</p><h1 className="text-2xl font-bold">Administração da plataforma</h1></div></div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">Crie redes somente por convite. O destinatário receberá um e-mail seguro para definir a senha; não existe cadastro público.</p>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-2"><Plus className="h-5 w-5 text-sky-600" /><h2 className="text-lg font-bold text-slate-900">Criar rede e convidar responsável</h2></div>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">Nome da rede<input required value={name} onChange={(e) => updateName(e.target.value)} placeholder="Rede Exemplo" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></label>
            <label className="block text-sm font-semibold text-slate-700">Identificador da rede<input required value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="rede-exemplo" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" title="Use letras minúsculas, números e hífens." className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></label>
            <label className="block text-sm font-semibold text-slate-700">Nome do responsável<input required value={adminName} onChange={(e) => setAdminName(e.target.value)} autoComplete="name" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></label>
            <label className="block text-sm font-semibold text-slate-700">E-mail do responsável<span className="relative mt-1.5 block"><Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input required type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} autoComplete="email" className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></span></label>
            {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            {success && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}
            <button disabled={sending} className="w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-60">{sending ? 'Enviando convite...' : 'Criar rede e enviar convite'}</button>
          </form>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-sky-600" /><h2 className="text-lg font-bold text-slate-900">Redes e filiais</h2></div><div className="mt-5 space-y-3">{organizations.length === 0 ? <p className="text-sm text-slate-500">Nenhuma rede cadastrada ainda.</p> : organizations.map((organization) => <div key={organization.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-800">{organization.name}</p><p className="mt-1 text-xs text-slate-500">{organization.slug}</p><p className="mt-1 text-xs text-slate-600">Responsável: {managerEmails(organization.organization_memberships).join(', ') || 'Sem responsável'}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${organization.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{organization.active ? '● Ativa' : '● Suspensa'}</span></div><div className="mt-3 rounded-xl bg-slate-50 p-3"><p className="flex items-center gap-1.5 text-xs font-bold text-slate-700"><Store className="h-3.5 w-3.5 text-sky-600" />{organization.stores.length} filial(is)</p>{organization.stores.length > 0 && <div className="mt-2 space-y-2">{organization.stores.map((store) => <p key={store.id} className="text-xs leading-5 text-slate-500"><span className="font-semibold text-slate-700">{store.name} ({store.code})</span><br />Gerente: {managerEmails(store.store_memberships).join(', ') || 'Sem gerente atribuído'}</p>)}</div>}</div><div className="mt-4 flex flex-wrap gap-2"><button disabled={changingOrganizationId === organization.id} onClick={() => void changeOrganizationStatus(organization)} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-60 ${organization.active ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>{organization.active ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}{organization.active ? 'Suspender acesso' : 'Reativar acesso'}</button><button disabled={changingOrganizationId === organization.id || !organization.active} onClick={() => void changeStoreCreationPermission(organization)} className={`rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-60 ${organization.store_creation_enabled ? 'bg-amber-50 text-amber-800 hover:bg-amber-100' : 'bg-sky-50 text-sky-700 hover:bg-sky-100'}`}>{organization.store_creation_enabled ? 'Bloquear criação de filiais' : 'Liberar criação de filiais'}</button></div></div>)}</div></section>
      </div>
    </div>
  </main>;
};
