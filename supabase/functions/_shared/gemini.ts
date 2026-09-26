const getGeminiKey = () => {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('A chave Gemini ainda não foi configurada no Supabase.');
  return key;
};

export const generateGeminiContent = async (model: string, body: Record<string, unknown>) => {
  if (!/^[a-zA-Z0-9._-]{3,80}$/.test(model)) throw new Error('Modelo de IA inválido.');
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': getGeminiKey() }, body: JSON.stringify(body), signal: AbortSignal.timeout(25_000) },
  );
  const data = await response.json();
  if (!response.ok) {
    console.error('Gemini request failed:', response.status);
    throw new Error('A IA está indisponível no momento. Tente novamente em alguns instantes.');
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('').trim();
  if (!text) throw new Error('O Gemini não retornou uma resposta utilizável.');
  return text;
};
