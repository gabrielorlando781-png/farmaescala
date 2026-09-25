import React, { FormEvent, useMemo, useState } from 'react';
import { Building2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface OrganizationOnboardingProps {
  onCreated: () => Promise<void>;
}

const slugify = (value: string) => value
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const OrganizationOnboarding: React.FC<OrganizationOnboardingProps> = ({ onCreated }) => {
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const suggestedSlug = useMemo(() => slugify(name), [name]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    const finalSlug = slugify(slug || suggestedSlug);
    if (!finalSlug) {
      setError('Informe um nome válido para a rede.');
      return;
    }

    setError('');
    setIsSaving(true);
    const { error: createError } = await supabase.rpc('create_organization', {
      organization_name: name.trim(),
      organization_slug: finalSlug,
      organization_legal_name: legalName.trim() || null,
      organization_cnpj: cnpj.trim() || null,
    });
    if (createError) {
      setError(createError.message.includes('duplicate') ? 'Esse identificador já está em uso. Escolha outro.' : createError.message);
      setIsSaving(false);
      return;
    }

    await onCreated();
    setIsSaving(false);
  };

  return <main className="min-h-screen bg-slate-950 px-4 py-8 flex items-center justify-center">
    <section className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-700 bg-white shadow-2xl shadow-slate-950/40">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 px-7 py-8 text-white">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500 shadow-lg shadow-sky-500/30"><Building2 className="h-6 w-6" /></div>
        <p className="text-sm font-semibold text-sky-300">Configuração inicial</p>
        <h1 className="mt-1 text-2xl font-bold">Cadastre sua rede de farmácias</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">Você será definido como administrador desta rede. Depois poderá cadastrar filiais e convidar os gerentes.</p>
      </div>
      <form onSubmit={handleSubmit} className="grid gap-4 p-7 sm:grid-cols-2">
        <label className="sm:col-span-2 block text-sm font-semibold text-slate-700">Nome da rede<input value={name} onChange={(event) => { setName(event.target.value); if (!slug) setSlug(slugify(event.target.value)); }} required placeholder="Ex.: Rede Farmácia Vida" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></label>
        <label className="block text-sm font-semibold text-slate-700">Razão social <span className="font-normal text-slate-400">(opcional)</span><input value={legalName} onChange={(event) => setLegalName(event.target.value)} placeholder="Ex.: Farmácia Vida Ltda." className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></label>
        <label className="block text-sm font-semibold text-slate-700">CNPJ <span className="font-normal text-slate-400">(opcional)</span><input value={cnpj} onChange={(event) => setCnpj(event.target.value)} inputMode="numeric" placeholder="00.000.000/0001-00" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></label>
        <label className="sm:col-span-2 block text-sm font-semibold text-slate-700">Identificador da rede<input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} required placeholder={suggestedSlug || 'rede-farmacia-vida'} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /><span className="mt-1 block text-xs font-normal text-slate-500">Usado internamente para identificar sua rede. Exemplo: rede-farmacia-vida</span></label>
        {error && <p role="alert" className="sm:col-span-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="sm:col-span-2 rounded-xl bg-sky-50 p-3 text-sm text-sky-900 flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" /><span>Apenas pessoas convidadas para esta rede poderão acessar seus dados.</span></div>
        <button disabled={isSaving} className="sm:col-span-2 flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-500 disabled:cursor-wait disabled:opacity-60"><CheckCircle2 className="h-4 w-4" />{isSaving ? 'Criando rede...' : 'Criar rede e continuar'}</button>
      </form>
    </section>
  </main>;
};
