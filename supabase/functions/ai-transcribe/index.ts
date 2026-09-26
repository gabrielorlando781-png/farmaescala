import { corsHeaders } from '../_shared/cors.ts';
import { consumeAiQuota } from '../_shared/auth.ts';
import { generateGeminiContent } from '../_shared/gemini.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return Response.json({ error: 'Método não permitido.' }, { status: 405, headers: corsHeaders });

  let usage: Awaited<ReturnType<typeof consumeAiQuota>> | undefined;
  try {
    const { audioBase64, mimeType } = await request.json();
    if (typeof audioBase64 !== 'string' || !audioBase64 || audioBase64.length > 6_000_000) throw new Error('Áudio inválido ou maior que o limite de gravação.');
    if (typeof mimeType !== 'string' || !mimeType.startsWith('audio/')) throw new Error('Formato de áudio inválido.');
    usage = await consumeAiQuota(request);
    if (!usage.allowed) return Response.json({ error: 'Você atingiu o limite diário de 20 solicitações à IA. O saldo reinicia à meia-noite (horário de Brasília).', usage }, { status: 429, headers: corsHeaders });
    const transcription = await generateGeminiContent(Deno.env.get('GEMINI_AUDIO_MODEL') || 'gemini-2.5-flash', {
      contents: [{ role: 'user', parts: [
        { inlineData: { mimeType, data: audioBase64 } },
        { text: 'Transcreva fielmente este áudio em português do Brasil. Retorne somente a transcrição, sem explicações, títulos ou comentários.' },
      ] }],
      generationConfig: { temperature: 0, maxOutputTokens: 800 },
    });
    return Response.json({ transcription, usage }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível transcrever o áudio agora.', usage }, { status: 400, headers: corsHeaders });
  }
});
