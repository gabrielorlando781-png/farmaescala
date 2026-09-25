import React, { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Building2, LockKeyhole, MapPin, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Store = { id: string; name: string; code: string; active: boolean; address: { city?: string; state?: string } | null };

interface StoreManagerPanelProps {
  organization: { id: string; name: string; store_creation_enabled: boolean };
  canCreateStores: boolean;
  onClose: () => void;
}

export const StoreManagerPanel: React.FC<StoreManagerPanelProps> = ({ organization, canCreateStores, onClose }) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const loadStores = async () => {
    if (!supabase) return;
    const { data, error: listError } = await supabase.from('stores').select('id, name, code, active, address').eq('organization_id', organization.id).order('name');
    if (listError) setError('Não foi possível carregar as filiais.');
    else setStores((data ?? []) as Store[]);
  };

  useEffect(() => { void loadStores(); }, [organization.id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !canCreateStores) return;
    setError(''); setSuccess(''); setSaving(true);
    const normalizedCode = code.trim().toUpperCase();
    try {
      const { error: insertError } = await supabase.from('stores').insert({
        organization_id: organization.id,
        name: name.trim(),
        code: normalizedCode,
        address: { city: city.trim(), state: state.trim().toUpperCase() },
      });
      if (insertError) throw insertError;
      setSuccess(`Filial ${name.trim()} cadastrada.`);
      setName(''); setCode(''); setCity(''); setState('');
      await loadStores();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível cadastrar a filial.');
    } finally { setSaving(false); }
  };

  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-5xl">
    <button onClick={onClose} className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-sky-700"><ArrowLeft className="h-4 w-4" />Voltar para a escala</button>
    <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-7 text-white shadow-xl"><div className="flex items-center gap-3"><div className="rounded-2xl bg-sky-500/20 p-3"><Building2 className="h-7 w-7 text-sky-300" /></div><div><p className="text-sm font-semibold text-sky-300">Rede {organization.name}</p><h1 className="text-2xl font-bold">Filiais</h1></div></div><p className="mt-4 text-sm leading-6 text-slate-300">Cada filial terá, na próxima etapa, seus próprios gerentes, funcionários e escalas.</p></section>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><h2 className="text-lg font-bold text-slate-900">Cadastrar filial</h2>{canCreateStores ? <form onSubmit={submit} className="mt-5 space-y-4"><label className="block text-sm font-semibold text-slate-700">Nome da filial<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Unidade Centro" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></label><label className="block text-sm font-semibold text-slate-700">Código interno<input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="CENTRO-01" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 uppercase outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></label><div className="grid grid-cols-[1fr_72px] gap-3"><label className="block text-sm font-semibold text-slate-700">Cidade<input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-500" /></label><label className="block text-sm font-semibold text-slate-700">UF<input maxLength={2} value={state} onChange={(e) => setState(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 uppercase outline-none focus:border-sky-500" /></label></div>{error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}{success && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}<button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-60"><Plus className="h-4 w-4" />{saving ? 'Cadastrando...' : 'Cadastrar filial'}</button></form> : <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-800"><LockKeyhole className="mb-2 h-5 w-5" />A criação de filiais está bloqueada para esta rede. Solicite a liberação ao administrador da plataforma.</div>}</section>
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><div className="flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">Filiais cadastradas</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{stores.length}</span></div><div className="mt-5 space-y-3">{stores.length === 0 ? <p className="text-sm text-slate-500">Nenhuma filial cadastrada ainda.</p> : stores.map((store) => <div key={store.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-800">{store.name}</p><p className="mt-1 text-xs text-slate-500">{store.code}</p>{(store.address?.city || store.address?.state) && <p className="mt-2 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" />{[store.address?.city, store.address?.state].filter(Boolean).join(' - ')}</p>}</div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${store.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{store.active ? 'Ativa' : 'Inativa'}</span></div></div>)}</div></section>
    </div>
  </div></main>;
};
