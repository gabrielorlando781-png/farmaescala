import React, { useMemo, useState } from 'react';
import { Bot, Check, Loader2, Send, Sparkles, X } from 'lucide-react';
import { AiAction, AiProposal, Employee, MonthSchedule, PharmacySettings, ShiftType } from '../types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AiManagerChatProps {
  currentYear: number;
  currentMonth: number;
  employees: Employee[];
  shifts: ShiftType[];
  settings: PharmacySettings;
  schedule: MonthSchedule;
  onConfirmActions: (actions: AiAction[]) => number;
}

export const AiManagerChat: React.FC<AiManagerChatProps> = ({
  currentYear,
  currentMonth,
  employees,
  shifts,
  settings,
  schedule,
  onConfirmActions,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingProposal, setPendingProposal] = useState<AiProposal | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Olá! Posso consultar a equipe e a escala, responder perguntas e preparar alterações para sua confirmação.',
    },
  ]);

  const safeContext = useMemo(() => ({
    period: { year: currentYear, month: currentMonth },
    pharmacy: settings,
    employees: employees.map(({ cpf: _cpf, phone: _phone, email: _email, ...employee }) => employee),
    shifts: shifts.map(({ color: _color, bgColor: _bg, textColor: _text, borderColor: _border, ...shift }) => shift),
    schedule: {
      status: schedule.status,
      assignments: schedule.assignments,
      notes: schedule.customNotes ?? {},
    },
  }), [currentYear, currentMonth, employees, shifts, settings, schedule]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);
    setPendingProposal(null);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, context: safeContext }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao consultar a IA.');

      setMessages((current) => [...current, { role: 'assistant', content: data.reply }]);
      if (Array.isArray(data.actions) && data.actions.length > 0) {
        setPendingProposal({
          summary: data.proposalSummary || 'Aplicar as alterações solicitadas.',
          actions: data.actions,
        });
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: error instanceof Error ? error.message : 'Não foi possível consultar a IA.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmProposal = () => {
    if (!pendingProposal) return;
    const appliedCount = onConfirmActions(pendingProposal.actions);
    setMessages((current) => [
      ...current,
      {
        role: 'assistant',
        content: appliedCount > 0
          ? `${appliedCount} alteração(ões) confirmada(s) e aplicada(s) no aplicativo.`
          : 'A proposta não pôde ser aplicada porque os dados não eram mais válidos.',
      },
    ]);
    setPendingProposal(null);
    if (appliedCount > 0) {
      window.setTimeout(() => setIsOpen(false), 500);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-bold text-white shadow-xl shadow-sky-900/20 transition hover:bg-sky-500 cursor-pointer"
        aria-label="Abrir assistente de IA"
      >
        <Sparkles className="h-4 w-4" />
        Assistente IA
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 backdrop-blur-[1px]">
          <section className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <header className="flex items-center justify-between bg-slate-900 px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold">Assistente do Gestor</h2>
                  <p className="text-[11px] text-sky-300">Consulta dados e propõe alterações</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
              {messages.map((message, index) => (
                <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    message.role === 'user'
                      ? 'rounded-br-md bg-sky-600 text-white'
                      : 'rounded-bl-md border border-slate-200 bg-white text-slate-700 shadow-sm'
                  }`}>
                    {message.content}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                  Analisando os dados atuais…
                </div>
              )}

              {pendingProposal && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="mb-1 text-xs font-bold text-amber-900">Confirmação necessária</div>
                  <p className="text-xs leading-relaxed text-amber-800">{pendingProposal.summary}</p>
                  <p className="mt-2 text-[11px] text-amber-700">
                    {pendingProposal.actions.length} alteração(ões) será(ão) aplicada(s).
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={confirmProposal} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer">
                      <Check className="h-3.5 w-3.5" /> Confirmar
                    </button>
                    <button type="button" onClick={() => setPendingProposal(null)} className="rounded-xl px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 cursor-pointer">
                      Descartar
                    </button>
                  </div>
                </div>
              )}
            </div>

            <footer className="border-t border-slate-200 bg-white p-4">
              <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-sky-400 focus-within:bg-white">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder="Ex.: troque o turno da Ana na sexta-feira"
                  rows={2}
                  className="max-h-28 flex-1 resize-none bg-transparent px-2 py-1 text-xs text-slate-800 outline-none placeholder:text-slate-400"
                />
                <button type="button" onClick={() => void sendMessage()} disabled={!input.trim() || isLoading} className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer">
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-slate-400">Nenhuma alteração é feita sem sua confirmação.</p>
            </footer>
          </section>
        </div>
      )}
    </>
  );
};
