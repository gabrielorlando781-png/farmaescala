import { createClient } from 'npm:@supabase/supabase-js@2';

export const consumeAiQuota = async (request: Request) => {
  const authorization = request.headers.get('Authorization');
  if (!authorization) throw new Error('Faça login para usar a assistente de IA.');

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) throw new Error('A função de IA não está configurada corretamente.');

  const client = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await client.rpc('consume_ai_request_v2');
  if (error) throw new Error('Não foi possível validar sua sessão de IA.');
  return data as { allowed: boolean; used: number; remaining: number; limit: number; resetsAt: string };
};
