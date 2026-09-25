const getGeminiKey = () => {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('A chave Gemini ainda não foi configurada no Supabase.');
  return key;
};

export const generateGeminiContent = async (model: string, body: Record<string, unknown>) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(getGeminiKey())}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'Não foi possível consultar o Gemini agora.');
  const text = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('').trim();
  if (!text) throw new Error('O Gemini não retornou uma resposta utilizável.');
  return text;
};
