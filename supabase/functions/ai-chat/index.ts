import { corsHeaders } from '../_shared/cors.ts';
import { consumeAiQuota } from '../_shared/auth.ts';
import { generateGeminiContent } from '../_shared/gemini.ts';

const systemInstruction = `Você é a assistente do FarmaEscala para gestores de farmácia. Responda em português do Brasil.
Retorne SOMENTE JSON válido no formato {"reply":"...","proposalSummary":"...","actions":[]}.
Você prepara uma proposta; nunca diga que a alteração já foi aplicada, pois o gestor ainda precisa confirmá-la.

REGRA CRÍTICA: quando o gestor pedir uma alteração e os dados necessários estiverem nos DADOS ATUAIS, você DEVE preencher actions. Não responda apenas com instruções. Nunca invente IDs: use exatamente os IDs existentes em employees e shifts. Datas devem ser YYYY-MM-DD e pertencer ao período informado. Se faltarem nome, data ou outro dado indispensável, faça uma pergunta e deixe actions vazio.

Cada item de actions deve usar EXATAMENTE uma das estruturas abaixo. patchJson é sempre uma STRING que contém JSON válido (não um objeto):
- Criar funcionário: {"type":"add_employee","patchJson":"{\\"name\\":\\"Ana Souza\\",\\"role\\":\\"balconista\\",\\"contractType\\":\\"escala_5x2\\",\\"weeklyHoursTarget\\":44}"}. role só pode ser farmaceutico, balconista, caixa, dermoconsultor, estoquista ou gerente. contractType pode ser clt_44h, escala_12x36, escala_6x1, escala_5x2, clt_40h ou estagio_30h.
- Editar/desativar/excluir funcionário: {"type":"update_employee","employeeId":"ID","patchJson":"{\\"phone\\":\\"...\\"}"}; {"type":"toggle_employee","employeeId":"ID"}; {"type":"delete_employee","employeeId":"ID"}.
- Definir turno em um dia: {"type":"set_assignment","employeeId":"ID","date":"YYYY-MM-DD","shiftId":"ID_DO_TURNO"}.
- Definir turno em intervalo: {"type":"set_assignment_range","employeeId":"ID","date":"INÍCIO","targetDate":"FIM","shiftId":"ID_DO_TURNO"}.
- Registrar férias, atestado, falta ou folga: {"type":"register_absence","employeeId":"ID","date":"INÍCIO","targetDate":"FIM","patchJson":"{\\"kind\\":\\"ferias\\",\\"note\\":\\"opcional\\"}"}. kind só pode ser ferias, atestado, falta ou folga. Para apenas um dia, repita a mesma data em date e targetDate.
- Trocar dois dias do MESMO funcionário: {"type":"swap_assignments","employeeId":"ID","date":"DIA_1","targetDate":"DIA_2"}. Para reorganizar a escala inteira: {"type":"rebalance_schedule"}. Para gerar 5x2: {"type":"generate_5x2","patchJson":"{\\"spreadDaysOff\\":true}"}.
- Criar turno: {"type":"add_shift","patchJson":"{\\"name\\":\\"Intermediário\\",\\"code\\":\\"INT\\",\\"startTime\\":\\"10:00\\",\\"endTime\\":\\"18:00\\",\\"breakMinutes\\":60,\\"durationHours\\":7}"}.
- Editar/excluir turno: {"type":"update_shift","shiftId":"ID","patchJson":"{\\"name\\":\\"...\\"}"}; {"type":"delete_shift","shiftId":"ID"}.
- Alterar configuração: {"type":"update_settings","patchJson":"{\\"minCashiers\\":2}"}.

Para planilhas, responda sobre datas, folgas ou nomes somente após conferir os dados fornecidos; cite evidências como "Aba: NOME, linha: N". Não suponha códigos ambíguos.`;

type JsonRecord = Record<string, unknown>;

const actionTypes = new Set([
  'set_assignment', 'set_assignment_range', 'register_absence', 'rebalance_schedule', 'swap_assignments',
  'add_employee', 'update_employee', 'toggle_employee', 'delete_employee', 'add_shift', 'update_shift',
  'delete_shift', 'update_settings', 'generate_5x2',
]);

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};

const normalizeDate = (value: unknown, context: JsonRecord): string | undefined => {
  if (typeof value !== 'string') return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (!match) return undefined;
  const period = asRecord(context.period);
  const year = match[3] || String(period.year || '');
  return year.length === 4 ? `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : undefined;
};

const normalizeAction = (rawAction: unknown, context: JsonRecord): JsonRecord | null => {
  const raw = asRecord(rawAction);
  const type = typeof raw.type === 'string' ? raw.type : typeof raw.action === 'string' ? raw.action : '';
  if (!actionTypes.has(type)) return null;

  const result: JsonRecord = { type };
  const employeeId = raw.employeeId ?? raw.employee_id;
  const shiftId = raw.shiftId ?? raw.shift_id;
  if (typeof employeeId === 'string') result.employeeId = employeeId;
  if (typeof shiftId === 'string') result.shiftId = shiftId;

  const date = normalizeDate(raw.date ?? raw.startDate ?? raw.start_date, context);
  const targetDate = normalizeDate(raw.targetDate ?? raw.endDate ?? raw.end_date, context);
  if (date) result.date = date;
  if (targetDate) result.targetDate = targetDate;

  const patch = raw.patchJson ?? raw.patch ?? raw.data ?? (
    type === 'add_employee' ? raw.employee : undefined
  ) ?? (type === 'register_absence' ? raw.absence : undefined);
  if (typeof patch === 'string') {
    try { JSON.parse(patch); result.patchJson = patch; } catch { /* Invalid patches are discarded. */ }
  } else if (patch && typeof patch === 'object' && !Array.isArray(patch)) {
    result.patchJson = JSON.stringify(patch);
  }

  // The application needs both fields even for a one-day absence.
  if (type === 'register_absence' && result.date && !result.targetDate) result.targetDate = result.date;
  return result;
};

const isExecutableAction = (action: JsonRecord): boolean => {
  const type = action.type;
  if (type === 'rebalance_schedule') return true;
  if (type === 'generate_5x2' || type === 'add_employee' || type === 'add_shift' || type === 'update_settings') return typeof action.patchJson === 'string';
  if (type === 'toggle_employee' || type === 'delete_employee') return typeof action.employeeId === 'string';
  if (type === 'update_employee') return typeof action.employeeId === 'string' && typeof action.patchJson === 'string';
  if (type === 'delete_shift') return typeof action.shiftId === 'string';
  if (type === 'update_shift') return typeof action.shiftId === 'string' && typeof action.patchJson === 'string';
  if (type === 'set_assignment' || type === 'set_assignment_range') return typeof action.employeeId === 'string' && typeof action.shiftId === 'string' && typeof action.date === 'string';
  if (type === 'register_absence') return typeof action.employeeId === 'string' && typeof action.date === 'string' && typeof action.targetDate === 'string' && typeof action.patchJson === 'string';
  if (type === 'swap_assignments') return typeof action.employeeId === 'string' && typeof action.date === 'string' && typeof action.targetDate === 'string';
  return false;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return Response.json({ error: 'Método não permitido.' }, { status: 405, headers: corsHeaders });

  try {
    await consumeAiQuota(request);
    const { messages, context } = await request.json();
    if (!Array.isArray(messages) || !context) throw new Error('Conversa ou contexto inválido.');
    if (JSON.stringify(context).length > 500_000) throw new Error('O contexto enviado para a IA é grande demais.');

    const conversation = messages.slice(-8).map((message: { role: string; content: string }) =>
      `${message.role === 'user' ? 'Gestor' : 'Assistente'}: ${message.content}`,
    ).join('\n');
    const text = await generateGeminiContent(Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash-lite', {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: `DADOS ATUAIS:\n${JSON.stringify(context)}\n\nCONVERSA:\n${conversation}` }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 1100, responseMimeType: 'application/json' },
    });
    const parsed = asRecord(JSON.parse(text));
    const rawActions = Array.isArray(parsed.actions) ? parsed.actions : [];
    const actions = rawActions
      .map((action) => normalizeAction(action, asRecord(context)))
      .filter((action): action is JsonRecord => action !== null)
      .filter(isExecutableAction);
    const invalidCount = rawActions.length - actions.length;
    const reply = String(parsed.reply || '');
    const proposalSummary = String(parsed.proposalSummary || '');
    return Response.json({
      reply: invalidCount > 0 && !actions.length
        ? `${reply}\n\nNão preparei uma alteração porque faltaram campos necessários na proposta. Informe os dados novamente de forma mais específica.`
        : reply,
      proposalSummary,
      actions,
    }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível consultar a IA agora.' }, { status: 400, headers: corsHeaders });
  }
});
