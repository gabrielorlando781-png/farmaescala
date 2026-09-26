import React, { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Building2, LockKeyhole, Mail, MapPin, Plus, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Store = { id: string; name: string; code: string; active: boolean; address: { city?: string; state?: string } | null };

interface StoreManagerPanelProps {
  organization: { id: string; name: string; store_creation_enabled: boolean };
  canCreateStores: boolean;
  initialSetup?: boolean;
  onClose: () => void;
  onSignOut?: () => void;
}

const inputClass = 'mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100';

export const StoreManagerPanel: React.FC<StoreManagerPanelProps> = ({ organization, canCreateStores, initialSetup = false, onClose, onSignOut }) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [name, setName] = useState('');
  const [code, setCode] = useState('FILIAL-01');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [managerStoreId, setManagerStoreId] = useState('');
  const [managerName, setManagerName] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  const loadStores = async () => {
    if (!supabase) return;
    const { data, error: listError } = await supabase.from('stores').select('id, name, code, active, address').eq('organization_id', organization.id).order('created_at');
    if (listError) setError('Não foi possível carregar as filiais. Tente atualizar a página.');
    else setStores((data ?? []) as Store[]);
    setLoadingStores(false);
  };

  useEffect(() => { void loadStores(); }, [organization.id]);
  useEffect(() => { if (!managerStoreId && stores[0]) setManagerStoreId(stores[0].id); }, [stores, managerStoreId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || (!initialSetup && !canCreateStores)) return;
    setError(''); setSuccess(''); setSaving(true);
    try {
      const normalizedCode = code.trim().toUpperCase();
      if (!name.trim() || !normalizedCode) throw new Error('Informe o nome e o código da filial.');
      if (state.trim() && !/^[A-Za-z]{2}$/.test(state.trim())) throw new Error('Informe uma UF válida com duas letras.');
      const result = initialSetup
        ? await supabase.rpc('create_initial_store', {
          target_organization_id: organization.id,
          store_name: name.trim(),
          store_code: normalizedCode,
          store_city: city.trim(),
          store_state: state.trim().toUpperCase(),
        })
        : await supabase.from('stores').insert({
          organization_id: organization.id,
          name: name.trim(),
          code: normalizedCode,
          address: { city: city.trim(), state: state.trim().toUpperCase() },
        });
      if (result.error) throw result.error;
      setSuccess(initialSetup ? 'Primeira filial cadastrada. Agora convide o gerente para concluir.' : `Filial ${name.trim()} cadastrada.`);
      setName(''); setCode(''); setCity(''); setState('');
      if (initialSetup && result.data && !Array.isArray(result.data)) setManagerStoreId((result.data as Store).id);
      await loadStores();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível cadastrar a filial.');
    } finally { setSaving(false); }
  };

  const inviteManager = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !managerStoreId) return;
    setError(''); setSuccess(''); setInviting(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('network-management', { body: { action: 'invite_store_manager', storeId: managerStoreId, managerName, managerEmail } });
      if (invokeError) {
        const body = await invokeError.context?.json?.().catch(() => null);
        throw new Error(body?.error || invokeError.message);
      }
      if (data?.error) throw new Error(data.error);
      setSuccess(data?.invitationSent === false ? `Gerente ${managerEmail} vinculado à filial.` : `Convite enviado para ${managerEmail}.`);
      setManagerName(''); setManagerEmail('');
      if (initialSetup) setSetupComplete(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível convidar o gerente.');
    } finally { setInviting(false); }
  };

  const firstStorePending = initialSetup && stores.length === 0;
  const showStoreForm = !loadingStores && (firstStorePending || (!initialSetup && canCreateStores));
  const showManagerForm = stores.length > 0 && (!initialSetup || !setupComplete);

  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-5xl">
    {initialSetup ? <div className="mb-5 flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-600">Configuração inicial da rede</p><button onClick={onSignOut} className="text-sm font-semibold text-slate-600 hover:text-sky-700">Sair da conta</button></div> : <button onClick={onClose} className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-sky-700"><ArrowLeft className="h-4 w-4" />Voltar para a escala</button>}
    <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-7 text-white shadow-xl"><div className="flex items-center gap-3"><div className="rounded-2xl bg-sky-500/20 p-3"><Building2 className="h-7 w-7 text-sky-300" /></div><div><p className="text-sm font-semibold text-sky-300">Rede {organization.name}</p><h1 className="text-2xl font-bold">{initialSetup ? 'Prepare sua primeira filial' : 'Filiais'}</h1></div></div><p className="mt-4 text-sm leading-6 text-slate-300">{initialSetup ? 'Sua primeira filial já está incluída. Cadastre-a e convide um gerente para começar a usar a plataforma.' : 'Gerencie suas filiais e convide os responsáveis por cada unidade.'}</p></section>
    {initialSetup && <div className="mt-6 flex gap-3 text-sm font-semibold"><span className={`rounded-full px-4 py-2 ${stores.length ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>1. Cadastrar filial</span><span className={`rounded-full px-4 py-2 ${setupComplete ? 'bg-emerald-100 text-emerald-800' : stores.length ? 'bg-sky-100 text-sky-800' : 'bg-slate-200 text-slate-500'}`}>2. Convidar gerente</span></div>}
    {(error || success) && <div className={`mt-5 rounded-2xl px-4 py-3 text-sm ${error ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{error || success}</div>}
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        {showStoreForm && <><h2 className="text-lg font-bold text-slate-900">{firstStorePending ? 'Cadastre a primeira filial' : 'Cadastrar outra filial'}</h2><form onSubmit={submit} className="mt-5 space-y-4"><label className="block text-sm font-semibold text-slate-700">Nome da filial<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Unidade Centro" className={inputClass} /></label><label className="block text-sm font-semibold text-slate-700">Código interno<input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="FILIAL-01" className={`${inputClass} uppercase`} /></label><div className="grid grid-cols-[1fr_72px] gap-3"><label className="block text-sm font-semibold text-slate-700">Cidade<input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} /></label><label className="block text-sm font-semibold text-slate-700">UF<input maxLength={2} value={state} onChange={(e) => setState(e.target.value)} className={`${inputClass} uppercase`} /></label></div><button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-60"><Plus className="h-4 w-4" />{saving ? 'Cadastrando...' : firstStorePending ? 'Criar minha primeira filial' : 'Cadastrar filial'}</button></form></>}
        {!loadingStores && !initialSetup && !canCreateStores && <div className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-800"><LockKeyhole className="mb-2 h-5 w-5" />Para criar mais filiais, solicite a liberação ao administrador da plataforma.</div>}
        {loadingStores && <p className="text-sm text-slate-500">Carregando filiais...</p>}
        {showManagerForm && <div className={showStoreForm ? 'mt-6 border-t border-slate-200 pt-6' : ''}><h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><UserPlus className="h-5 w-5 text-sky-600" />{initialSetup ? 'Convide o gerente da filial' : 'Convidar gerente de filial'}</h2><p className="mt-2 text-sm text-slate-600">O gerente receberá um e-mail para criar a própria senha.</p><form onSubmit={inviteManager} className="mt-5 space-y-4"><label className="block text-sm font-semibold text-slate-700">Filial<select required value={managerStoreId} onChange={(e) => setManagerStoreId(e.target.value)} className={inputClass}>{stores.map((store) => <option key={store.id} value={store.id}>{store.name} · {store.code}</option>)}</select></label><label className="block text-sm font-semibold text-slate-700">Nome do gerente<input required value={managerName} onChange={(e) => setManagerName(e.target.value)} className={inputClass} /></label><label className="block text-sm font-semibold text-slate-700">E-mail do gerente<span className="relative mt-1.5 block"><Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input required type="email" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 outline-none focus:border-sky-500" /></span></label><button disabled={inviting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-60"><UserPlus className="h-4 w-4" />{inviting ? 'Enviando...' : 'Enviar convite ao gerente'}</button></form></div>}
        {initialSetup && setupComplete && <div><h2 className="text-lg font-bold text-slate-900">Tudo pronto!</h2><p className="mt-2 text-sm text-slate-600">Sua filial foi criada e o gerente foi convidado. Você já pode entrar na plataforma.</p><button onClick={onClose} className="mt-5 w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white hover:bg-sky-500">Entrar na filial</button></div>}
      </section>
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><div className="flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">Filiais cadastradas</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{stores.length}</span></div><div className="mt-5 space-y-3">{stores.length === 0 ? <p className="text-sm text-slate-500">A primeira filial aparecerá aqui depois do cadastro.</p> : stores.map((store) => <div key={store.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-800">{store.name}</p><p className="mt-1 text-xs text-slate-500">{store.code}</p>{(store.address?.city || store.address?.state) && <p className="mt-2 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" />{[store.address?.city, store.address?.state].filter(Boolean).join(' - ')}</p>}</div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${store.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{store.active ? 'Ativa' : 'Inativa'}</span></div></div>)}</div></section>
    </div>
  </div></main>;
};
