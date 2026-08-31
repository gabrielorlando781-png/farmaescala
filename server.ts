import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const isProduction = process.argv.includes('--production');

app.use(express.json({ limit: '1mb' }));

const responseSchema = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: 'Resposta curta em português para o gestor.' },
    proposalSummary: { type: 'string', description: 'Resumo das mudanças propostas; vazio quando não houver alteração.' },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['set_assignment', 'set_assignment_range', 'register_absence', 'rebalance_schedule', 'swap_assignments', 'add_employee', 'update_employee', 'toggle_employee', 'delete_employee', 'add_shift', 'update_shift', 'delete_shift', 'update_settings', 'generate_5x2'],
          },
          employeeId: { type: 'string' },
          date: { type: 'string', description: 'Data YYYY-MM-DD.' },
          targetDate: { type: 'string', description: 'Data de destino YYYY-MM-DD para uma troca.' },
          shiftId: { type: 'string' },
          patchJson: { type: 'string', description: 'Objeto JSON serializado contendo somente os campos a alterar.' },
        },
        required: ['type'],
      },
    },
  },
  required: ['reply', 'proposalSummary', 'actions'],
};

app.post('/api/ai/chat', async (request, response) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return response.status(503).json({ error: 'A chave GEMINI_API_KEY não está configurada no servidor.' });
    }

    const { messages, context } = request.body ?? {};
    if (!Array.isArray(messages) || !context) {
      return response.status(400).json({ error: 'Conversa ou contexto inválido.' });
    }

    const latestUserMessage = [...messages].reverse().find(
      (message: { role: string; content: string }) => message.role === 'user'
    )?.content || '';
    const activeCashiers = Array.isArray(context.employees)
      ? context.employees.filter((employee: { role?: string; active?: boolean }) => employee.role === 'caixa' && employee.active !== false)
      : [];
    const asksToAdjustCashiers = /(?:ajust|reajust|encaix|inclu)[\s\S]{0,80}\bcaixa(?:s)?\b/i.test(latestUserMessage);

    // "Caixas" é uma forma recorrente de se referir às funcionárias com o cargo
    // caixa. Resolver esse caso diretamente impede que o modelo peça novamente
    // os dados que já estão disponíveis no contexto da escala.
    if (asksToAdjustCashiers && activeCashiers.length > 0) {
      return response.json({
        reply: `Encontrei ${activeCashiers.length} caixa(s) ativa(s). Preparei o reajuste da escala para distribuí-las na cobertura.`,
        proposalSummary: 'Reequilibrar a escala 5x2 incluindo as caixas ativas e preservando ausências registradas.',
        actions: [{ type: 'rebalance_schedule' }],
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = `
Você é a assistente do FarmaEscala para gestores de farmácia. Responda sempre em português do Brasil.
Analise somente os dados fornecidos. Você pode esclarecer dúvidas livremente, mas NUNCA diga que uma alteração já foi aplicada.
Quando houver importedSpreadsheet nos dados atuais, ela é uma planilha de escala previamente montada pelo gestor. Primeiro entenda o método usado nessa escala: pessoas, cargos, turnos, dias trabalhados, folgas, cobertura e padrões de distribuição. Ao responder, explique os padrões encontrados e use-os como referência para aperfeiçoar sugestões futuras nesta mesma conversa. Não invente dados que não estejam no arquivo e não aplique nenhuma alteração baseada nele sem confirmação.
Quando o gestor pedir uma mudança, crie uma proposta clara em proposalSummary e liste as ações. O sistema pedirá confirmação antes de executá-las.

Ações permitidas:
- set_assignment: exige employeeId, date e shiftId existentes.
- set_assignment_range: exige employeeId, date, targetDate e shiftId existentes. Aplica o mesmo turno em todos os dias do intervalo, inclusive.
- register_absence: exige employeeId, date, targetDate e patchJson com kind igual a atestado, falta ou folga. Registra o período sem escalar trabalho. Use atestado para licença médica, falta para ausência não justificada e folga para descanso programado.
- rebalance_schedule: redistribui a escala 5x2 para toda a equipe ativa, preservando atestados, faltas e folgas programadas registradas pela IA. Use depois de adicionar funcionários, registrar ausência ou quando o gestor pedir para reajustar a cobertura.
- swap_assignments: exige employeeId, date e targetDate. Troca exatamente as atribuições dos dois dias do mesmo funcionário.
- add_employee: exige patchJson com pelo menos name, role e roleTitle. Use escala_5x2 como contractType quando não for informado.
- update_employee: exige employeeId e patchJson. Campos permitidos: name, role, roleTitle, contractType, weeklyHoursTarget, email, phone, active, preferredShiftId, unavailableDays e notes.
Os únicos cargos válidos são: farmaceutico, balconista, caixa, dermoconsultor, estoquista e gerente. Existe apenas o cargo farmaceutico; nunca use farmacêutico RT, assistente ou CRF no cadastro do funcionário.
- toggle_employee: exige employeeId.
- delete_employee: exige employeeId. Use somente quando o gestor pedir claramente a exclusão.
- add_shift: exige patchJson com name, code, startTime, endTime, breakMinutes e durationHours.
- update_shift: use shiftId e patchJson. Campos permitidos: name, code, startTime, endTime, breakMinutes, durationHours, isNightShift, requiresPharmacist e description.
- delete_shift: exige shiftId. Use somente quando o gestor pedir claramente e nunca exclua um turno de folga.
- update_settings: exige patchJson com campos existentes das configurações.
- generate_5x2: recria o mês inteiro em ciclo 5 dias trabalhados e 2 folgas.

Nunca invente IDs. Se faltarem dados ou o pedido for ambíguo, faça uma pergunta e retorne actions vazio.
Mudancas de escala devem considerar preferências, folgas e cobertura farmacêutica disponíveis no contexto.
Quando o gestor pedir para mover ou trocar uma folga de um dia para outro, use swap_assignments. Exemplo: "troque a folga do Robson do dia 3 para o dia 4" deve trocar as atribuições completas dos dias 3 e 4, mantendo o turno que estava no dia 4 no dia 3. Nunca use apenas set_assignment nesse caso.
Quando o gestor pedir para ajustar funcionários novos (por exemplo, "ajuste as novas caixas na escala"), use rebalance_schedule. A palavra "caixas" normalmente significa funcionárias já cadastradas com role igual a caixa: se existirem caixas ativas no contexto, não peça nomes novamente e proponha rebalance_schedule. Só peça nomes quando não houver nenhuma pessoa caixa cadastrada e o pedido não trouxer os novos nomes. Se os novos nomes forem informados e ainda não existirem, primeiro use uma ação add_employee para cada pessoa e depois rebalance_schedule.
Quando houver atestado, falta ou folga de vários dias, registre o período com register_absence e, se o gestor pedir ajuste ou cobertura, inclua rebalance_schedule depois. Sempre informe no resumo os dias e o tipo de ausência. Para marcar um funcionário em um turno por vários dias, use set_assignment_range.
`;

    const conversation = messages
      .slice(-8)
      .map((message: { role: string; content: string }) => `${message.role === 'user' ? 'Gestor' : 'Assistente'}: ${message.content}`)
      .join('\n');

    const requestConfig = {
      contents: `DADOS ATUAIS:\n${JSON.stringify(context)}\n\nCONVERSA:\n${conversation}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseJsonSchema: responseSchema,
        temperature: 0,
        maxOutputTokens: 700,
      },
    };

    const modelCandidates = Array.from(new Set([
      process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash',
      'gemini-2.5-flash',
    ]));
    let result: Awaited<ReturnType<typeof ai.models.generateContent>> | undefined;
    let selectedModel: string | undefined;
    let lastError: unknown;

    const callModel = async (model: string, controller: AbortController, delayMs = 0) => {
      if (delayMs > 0) {
        await new Promise<void>((resolve, reject) => {
          const delay = setTimeout(resolve, delayMs);
          controller.signal.addEventListener('abort', () => {
            clearTimeout(delay);
            reject(new Error('Tentativa cancelada.'));
          }, { once: true });
        });
      }

      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const modelResult = await ai.models.generateContent({
          model,
          contents: requestConfig.contents,
          config: {
            ...requestConfig.config,
            ...(model.startsWith('gemini-3')
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }
              : {}),
            abortSignal: controller.signal,
          },
        });
        return { result: modelResult, model };
      } finally {
        clearTimeout(timeout);
      }
    };

    const fastModels = modelCandidates.slice(0, 2);
    const fastControllers = fastModels.map(() => new AbortController());
    try {
      const winner = await Promise.any(fastModels.map((model, index) =>
        callModel(model, fastControllers[index], index === 0 ? 0 : 1200)
      ));
      result = winner.result;
      selectedModel = winner.model;
    } catch (error) {
      lastError = error;
    } finally {
      fastControllers.forEach((controller) => controller.abort());
    }

    for (const model of modelCandidates.slice(2)) {
      if (result) break;
      const controller = new AbortController();
      try {
        const fallback = await callModel(model, controller);
        result = fallback.result;
        selectedModel = fallback.model;
      } catch (error) {
        lastError = error;
      } finally {
        controller.abort();
      }
    }

    if (!result) throw lastError;
    if (selectedModel) response.setHeader('X-FarmaEscala-AI-Model', selectedModel);

    const parsed = JSON.parse(result.text || '{}');
    return response.json(parsed);
  } catch (error) {
    console.error('AI chat error:', error);
    return response.status(500).json({ error: 'Não foi possível consultar a IA agora. Tente novamente.' });
  }
});

if (isProduction) {
  const clientBuildPath = path.resolve('dist');
  app.use(express.static(clientBuildPath));
  app.get('*', (_request, response) => {
    response.sendFile(path.join(clientBuildPath, 'index.html'));
  });
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(port, '0.0.0.0', () => {
  console.log(`FarmaEscala (${isProduction ? 'produção' : 'desenvolvimento'}) disponível em http://localhost:${port}`);
});
