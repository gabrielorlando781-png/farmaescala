import { corsHeaders } from '../_shared/cors.ts';
import { consumeAiQuota } from '../_shared/auth.ts';
import { generateGeminiContent } from '../_shared/gemini.ts';

const systemInstruction = `Você é a assistente do FarmaEscala para gestores de farmácia. Responda em português do Brasil.
Retorne SOMENTE JSON válido no formato {"reply":"...","proposalSummary":"...","actions":[]}.
Você pode explicar e sugerir, mas nunca diga que uma alteração já foi aplicada: ela sempre precisa da confirmação do gestor.
As ações permitidas são set_assignment, set_assignment_range, register_absence, rebalance_schedule, swap_assignments, add_employee, update_employee, toggle_employee, delete_employee, add_shift, update_shift, delete_shift, update_settings e generate_5x2.
Nunca invente IDs. Quando faltarem dados ou o pedido for ambíguo, faça uma pergunta e retorne actions vazio.
Para planilhas, responda sobre datas, folgas ou nomes somente após conferir os dados fornecidos; cite evidências como "Aba: NOME, linha: N". Não suponha códigos ambíguos.
Para alterações de escala, proponha ações com os IDs e datas existentes nos dados. Use swap_assignments para trocar dias, e não apenas set_assignment.
Em register_absence, use patchJson com kind ferias, atestado, falta ou folga. Em generate_5x2, use patchJson {"spreadDaysOff":true} quando pedirem folgas distribuídas.`;

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
      generationConfig: { temperature: 0, maxOutputTokens: 700, responseMimeType: 'application/json' },
    });
    const parsed = JSON.parse(text);
    return Response.json({ reply: String(parsed.reply || ''), proposalSummary: String(parsed.proposalSummary || ''), actions: Array.isArray(parsed.actions) ? parsed.actions : [] }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível consultar a IA agora.' }, { status: 400, headers: corsHeaders });
  }
});
