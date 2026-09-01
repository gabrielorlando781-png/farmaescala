import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Bot, Check, FileSpreadsheet, FileUp, History, Loader2, MessageSquarePlus, Send, Sparkles, Trash2, X } from 'lucide-react';
import { AiAction, AiProposal, Employee, MonthSchedule, PharmacySettings, ShiftType } from '../types';

interface ChatMessage { role: 'user' | 'assistant'; content: string; }
interface ImportedSpreadsheet { fileName: string; importedAt: string; sheets: { name: string; rows: string[][] }[]; }
interface SavedConversation {
  id: string; title: string; createdAt: string; updatedAt: string;
  messages: ChatMessage[]; importedSpreadsheet?: ImportedSpreadsheet;
}
interface AiManagerChatProps {
  currentYear: number; currentMonth: number; employees: Employee[]; shifts: ShiftType[];
  settings: PharmacySettings; schedule: MonthSchedule; onConfirmActions: (actions: AiAction[]) => number;
}

const STORAGE_KEY = 'farma_ai_conversations_v1';
const welcomeMessage: ChatMessage = { role: 'assistant', content: 'Olá! Posso consultar a equipe e a escala, analisar uma planilha existente e preparar alterações para sua confirmação.' };
const createConversation = (): SavedConversation => {
  const now = new Date().toISOString();
  return { id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, title: 'Nova conversa', createdAt: now, updatedAt: now, messages: [welcomeMessage] };
};
const readConversations = (): SavedConversation[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) as SavedConversation[] : [];
    return Array.isArray(parsed) && parsed.length ? parsed : [createConversation()];
  } catch { return [createConversation()]; }
};
const compactCell = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 100);
const parseSpreadsheet = async (file: File): Promise<ImportedSpreadsheet> => {
  if (file.size > 3 * 1024 * 1024) throw new Error('A planilha deve ter no máximo 3 MB para análise rápida.');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const sheets = workbook.SheetNames.slice(0, 3).map((name) => {
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: '', blankrows: false });
    return { name, rows: rawRows.slice(0, 80).map((row) => row.slice(0, 16).map(compactCell)).filter((row) => row.some(Boolean)) };
  }).filter((sheet) => sheet.rows.length > 0);
  if (!sheets.length) throw new Error('Não encontrei dados utilizáveis nessa planilha.');
  return { fileName: file.name, importedAt: new Date().toISOString(), sheets };
};

export const AiManagerChat: React.FC<AiManagerChatProps> = ({ currentYear, currentMonth, employees, shifts, settings, schedule, onConfirmActions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingProposal, setPendingProposal] = useState<AiProposal | null>(null);
  const [conversations, setConversations] = useState<SavedConversation[]>(readConversations);
  const [selectedConversationId, setActiveConversationId] = useState('');
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations)); }, [conversations]);
  const activeConversation = conversations.find((conversation) => conversation.id === selectedConversationId) ?? conversations[0];
  const activeConversationId = activeConversation.id;
  const messages = activeConversation.messages;
  const updateActiveConversation = (update: (conversation: SavedConversation) => SavedConversation) => {
    setConversations((current) => current.map((conversation) => conversation.id === activeConversationId ? update(conversation) : conversation));
  };
  const appendMessages = (newMessages: ChatMessage[]) => updateActiveConversation((conversation) => ({
    ...conversation,
    title: conversation.title === 'Nova conversa' && newMessages.some((message) => message.role === 'user') ? newMessages.find((message) => message.role === 'user')!.content.slice(0, 42) : conversation.title,
    messages: [...conversation.messages, ...newMessages], updatedAt: new Date().toISOString(),
  }));
  const safeContext = useMemo(() => ({
    period: { year: currentYear, month: currentMonth }, pharmacy: settings,
    employees: employees.map(({ cpf: _cpf, phone: _phone, email: _email, ...employee }) => employee),
    shifts: shifts.map(({ color: _color, bgColor: _bg, textColor: _text, borderColor: _border, ...shift }) => shift),
    schedule: { status: schedule.status, assignments: schedule.assignments, notes: schedule.customNotes ?? {} },
    importedSpreadsheet: activeConversation.importedSpreadsheet && {
      fileName: activeConversation.importedSpreadsheet.fileName,
      importedAt: activeConversation.importedSpreadsheet.importedAt,
      // Preservar a referência da linha permite que a resposta da IA seja
      // auditável, mesmo quando a planilha usa uma estrutura fora do padrão.
      sheets: activeConversation.importedSpreadsheet.sheets.map((sheet) => ({
        name: sheet.name,
        rows: sheet.rows.map((cells, index) => ({ line: index + 1, cells })),
      })),
    },
  }), [currentYear, currentMonth, employees, shifts, settings, schedule, activeConversation.importedSpreadsheet]);

  const askAi = async (text: string) => {
    if (!text || isLoading) return;
    const conversationId = activeConversationId;
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    appendMessages([{ role: 'user', content: text }]); setInput(''); setIsLoading(true); setPendingProposal(null);
    try {
      const response = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: nextMessages, context: safeContext }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao consultar a IA.');
      setConversations((current) => current.map((conversation) => conversation.id === conversationId ? { ...conversation, messages: [...conversation.messages, { role: 'assistant', content: data.reply }], updatedAt: new Date().toISOString() } : conversation));
      if (conversationId === activeConversationId && Array.isArray(data.actions) && data.actions.length) setPendingProposal({ summary: data.proposalSummary || 'Aplicar as alterações solicitadas.', actions: data.actions });
    } catch (error) {
      setConversations((current) => current.map((conversation) => conversation.id === conversationId ? { ...conversation, messages: [...conversation.messages, { role: 'assistant', content: error instanceof Error ? error.message : 'Não foi possível consultar a IA.' }], updatedAt: new Date().toISOString() } : conversation));
    } finally { setIsLoading(false); }
  };
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; setImportError('');
    try {
      const importedSpreadsheet = await parseSpreadsheet(file);
      updateActiveConversation((conversation) => ({ ...conversation, importedSpreadsheet, updatedAt: new Date().toISOString() }));
    } catch (error) { setImportError(error instanceof Error ? error.message : 'Não foi possível ler a planilha.'); }
  };
  const startConversation = () => {
    const conversation = createConversation(); setConversations((current) => [conversation, ...current]); setActiveConversationId(conversation.id); setPendingProposal(null); setImportError('');
  };
  const deleteConversation = (id: string) => {
    if (conversations.length === 1) return;
    const remaining = conversations.filter((conversation) => conversation.id !== id); setConversations(remaining);
    if (id === activeConversationId) setActiveConversationId(remaining[0].id); setPendingProposal(null);
  };
  const confirmProposal = () => {
    if (!pendingProposal) return;
    const appliedCount = onConfirmActions(pendingProposal.actions);
    appendMessages([{ role: 'assistant', content: appliedCount > 0 ? `${appliedCount} alteração(ões) confirmada(s) e aplicada(s) no aplicativo.` : 'A proposta não pôde ser aplicada porque os dados não eram mais válidos.' }]);
    setPendingProposal(null);
  };

  return <>
    <button type="button" onClick={() => setIsOpen(true)} className="fixed bottom-6 right-4 z-40 flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-bold text-white shadow-xl shadow-sky-900/20 transition hover:bg-sky-500 cursor-pointer sm:right-6" aria-label="Abrir assistente de IA"><Sparkles className="h-4 w-4" /> Assistente IA</button>
    {isOpen && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 backdrop-blur-[1px]"><section className="flex h-full w-full max-w-4xl bg-white shadow-2xl">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-slate-50 sm:flex">
        <div className="border-b border-slate-200 p-3"><button type="button" onClick={startConversation} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-bold text-white hover:bg-slate-700 cursor-pointer"><MessageSquarePlus className="h-4 w-4" /> Nova conversa</button></div>
        <div className="flex-1 overflow-y-auto p-2"><div className="mb-2 flex items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400"><History className="h-3 w-3" /> Conversas</div>
          {conversations.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((conversation) => <div key={conversation.id} className={`group mb-1 flex items-center rounded-xl ${conversation.id === activeConversationId ? 'bg-sky-100 text-sky-900' : 'text-slate-600 hover:bg-slate-200/70'}`}><button type="button" onClick={() => { setActiveConversationId(conversation.id); setPendingProposal(null); }} className="min-w-0 flex-1 px-3 py-2.5 text-left cursor-pointer"><div className="truncate text-xs font-semibold">{conversation.title}</div><div className="mt-0.5 text-[10px] opacity-60">{new Date(conversation.updatedAt).toLocaleDateString('pt-BR')}</div></button>{conversations.length > 1 && <button type="button" onClick={() => deleteConversation(conversation.id)} className="mr-1 rounded-lg p-1.5 opacity-0 hover:bg-rose-100 hover:text-rose-600 group-hover:opacity-100 cursor-pointer" aria-label="Excluir conversa"><Trash2 className="h-3.5 w-3.5" /></button>}</div>)}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between bg-slate-900 px-4 py-4 text-white sm:px-5"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600"><Bot className="h-5 w-5" /></div><div><h2 className="text-sm font-bold">Assistente do Gestor</h2><p className="text-[11px] text-sky-300">Consulta dados, planilhas e propõe alterações</p></div></div><div className="flex items-center gap-1"><button type="button" onClick={startConversation} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 sm:hidden cursor-pointer" aria-label="Nova conversa"><MessageSquarePlus className="h-4 w-4" /></button><button type="button" onClick={() => setIsOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"><X className="h-5 w-5" /></button></div></header>
        <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
          {activeConversation.importedSpreadsheet && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900"><span className="flex min-w-0 items-center gap-2"><FileSpreadsheet className="h-4 w-4 shrink-0" /><span className="truncate"><strong>{activeConversation.importedSpreadsheet.fileName}</strong> pronta para análise</span></span><button type="button" onClick={() => void askAi('Analise a planilha importada com rigor. Primeiro identifique as abas, cabeçalhos e legenda. Depois resuma o padrão de escala, turnos e folgas. Para cada dado relevante, cite a aba e a linha de origem. Se algum código ou coluna for ambíguo, não suponha: explique a dúvida antes de tirar conclusões.')} disabled={isLoading} className="rounded-lg bg-sky-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-sky-500 disabled:opacity-50 cursor-pointer">Analisar planilha</button></div>}
          {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${message.role === 'user' ? 'rounded-br-md bg-sky-600 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-700 shadow-sm'}`}>{message.content}</div></div>)}
          {isLoading && <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin text-sky-600" /> Analisando os dados…</div>}
          {pendingProposal && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="mb-1 text-xs font-bold text-amber-900">Confirmação necessária</div><p className="text-xs leading-relaxed text-amber-800">{pendingProposal.summary}</p><p className="mt-2 text-[11px] text-amber-700">{pendingProposal.actions.length} alteração(ões) será(ão) aplicada(s).</p><div className="mt-3 flex gap-2"><button type="button" onClick={confirmProposal} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"><Check className="h-3.5 w-3.5" /> Confirmar</button><button type="button" onClick={() => setPendingProposal(null)} className="rounded-xl px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 cursor-pointer">Descartar</button></div></div>}
        </div>
        <footer className="border-t border-slate-200 bg-white p-3 sm:p-4"><input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={(event) => void handleImport(event)} className="hidden" /><div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-sky-400 focus-within:bg-white"><button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sky-700 hover:bg-sky-100 cursor-pointer" title="Importar planilha" aria-label="Importar planilha"><FileUp className="h-4 w-4" /></button><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void askAi(input.trim()); } }} placeholder="Ex.: analise a escala importada ou troque o turno da Ana" rows={2} className="max-h-28 flex-1 resize-none bg-transparent px-1 py-1 text-xs text-slate-800 outline-none placeholder:text-slate-400" /><button type="button" onClick={() => void askAi(input.trim())} disabled={!input.trim() || isLoading} className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"><Send className="h-4 w-4" /></button></div>{importError && <p className="mt-1.5 text-center text-[10px] text-rose-600">{importError}</p>}<p className="mt-2 text-center text-[10px] text-slate-400">Planilhas e conversas ficam salvas neste navegador. Nenhuma alteração é feita sem sua confirmação.</p></footer>
      </div>
    </section></div>}
  </>;
};
