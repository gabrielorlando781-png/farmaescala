import React, { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

type AuthMode = 'sign_in' | 'sign_up' | 'forgot_password' | 'update_password';

interface AuthScreenProps { recoveryMode?: boolean; }

export const AuthScreen: React.FC<AuthScreenProps> = ({ recoveryMode = false }) => {
  const [mode, setMode] = useState<AuthMode>(recoveryMode ? 'update_password' : 'sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { if (recoveryMode) setMode('update_password'); }, [recoveryMode]);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode); setError(''); setSuccess(''); setPassword(''); setConfirmPassword('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setError(''); setSuccess('');
    if ((mode === 'sign_up' || mode === 'update_password') && password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.'); return;
    }
    if ((mode === 'sign_up' || mode === 'update_password') && password !== confirmPassword) {
      setError('As senhas não conferem.'); return;
    }
    setIsSubmitting(true);
    try {
      if (mode === 'sign_in') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      } else if (mode === 'sign_up') {
        const { error: signUpError } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.origin },
        });
        if (signUpError) throw signUpError;
        setSuccess('Conta criada. Verifique seu e-mail para confirmar o acesso.');
      } else if (mode === 'forgot_password') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (resetError) throw resetError;
        setSuccess('Enviamos um link para redefinir sua senha.');
      } else {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setSuccess('Senha atualizada. Você já pode acessar o FarmaEscala.');
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível concluir a solicitação.');
    } finally { setIsSubmitting(false); }
  };

  const titles: Record<AuthMode, string> = { sign_in: 'Acesse sua conta', sign_up: 'Crie sua conta', forgot_password: 'Recupere sua senha', update_password: 'Defina uma nova senha' };
  const descriptions: Record<AuthMode, string> = { sign_in: 'Entre para gerenciar as escalas da sua farmácia.', sign_up: 'Use seu e-mail profissional para iniciar o acesso.', forgot_password: 'Informe seu e-mail e enviaremos um link seguro.', update_password: 'Escolha uma senha nova para continuar.' };

  return <main className="min-h-screen bg-slate-950 px-4 py-8 flex items-center justify-center">
    <section className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-700 bg-white shadow-2xl shadow-slate-950/40">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 px-7 py-8 text-white">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500 shadow-lg shadow-sky-500/30"><ShieldCheck className="h-6 w-6" /></div>
        <p className="text-sm font-semibold text-sky-300">FarmaEscala</p><h1 className="mt-1 text-2xl font-bold">{titles[mode]}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">{descriptions[mode]}</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 p-7">
        {mode === 'sign_up' && <label className="block text-sm font-semibold text-slate-700">Nome completo<input value={fullName} onChange={(event) => setFullName(event.target.value)} required autoComplete="name" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></label>}
        {mode !== 'update_password' && <label className="block text-sm font-semibold text-slate-700">E-mail<span className="relative mt-1.5 block"><Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="voce@farmacia.com.br" className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></span></label>}
        {mode !== 'forgot_password' && <label className="block text-sm font-semibold text-slate-700">{mode === 'update_password' ? 'Nova senha' : 'Senha'}<span className="relative mt-1.5 block"><LockKeyhole className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete={mode === 'update_password' || mode === 'sign_up' ? 'new-password' : 'current-password'} className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></span></label>}
        {(mode === 'sign_up' || mode === 'update_password') && <label className="block text-sm font-semibold text-slate-700">Confirmar senha<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required autoComplete="new-password" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></label>}
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {success && <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{success}</p>}
        <button disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-500 disabled:cursor-wait disabled:opacity-60">{mode === 'forgot_password' && <KeyRound className="h-4 w-4" />}{isSubmitting ? 'Aguarde...' : mode === 'sign_in' ? 'Entrar' : mode === 'sign_up' ? 'Criar conta' : mode === 'forgot_password' ? 'Enviar link' : 'Atualizar senha'}</button>
        <div className="space-y-2 text-center text-sm">
          {mode === 'sign_in' && <><button type="button" onClick={() => changeMode('forgot_password')} className="block w-full text-sky-700 hover:underline">Esqueci minha senha</button><button type="button" onClick={() => changeMode('sign_up')} className="text-slate-600 hover:text-sky-700 hover:underline">Ainda não tem conta? Criar acesso</button></>}
          {(mode === 'sign_up' || mode === 'forgot_password') && <button type="button" onClick={() => changeMode('sign_in')} className="inline-flex items-center gap-1 text-slate-600 hover:text-sky-700 hover:underline"><ArrowLeft className="h-3.5 w-3.5" />Voltar para entrar</button>}
        </div>
      </form>
    </section>
  </main>;
};
