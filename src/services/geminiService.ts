
// services/geminiService.ts

import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { loadSecureSetting } from "../lib/crypto";
import { Transaction, Language, NfseClient } from "../types";

export interface Attachment {
  mimeType: string;
  data: string;
}

const SYSTEM_PROMPT = `
    ## 🤖 PERFIL: AUDITOR FINANCEIRO IA & ESPECIALISTA EM OCR
    Seu objetivo é transformar documentos financeiros (Recibos, Cupons Fiscais, Extratos Bancários PDF/OFX, Faturas) em dados estruturados com 100% de precisão.
    
    ## 📸 DIRETRIZES DE OCR E PROCESSAMENTO
    Ao receber imagens ou documentos:
    1. **Identificação de Documento:** Determine se é um Recibo Único, Extrato Bancário (PDF/OFX), Cupom Fiscal ou Fatura de Cartão.
    2. **Extração de Metadados:**
       - **Banco:** Se for extrato, identifique a instituição (Itaú, Nubank, Bradesco, etc).
       - **Entidade:** Identifique se os gastos são majoritariamente PJ (Empresa) ou PF (Pessoal).
    3. **Categorização Inteligente (BRASIL):**
       - **Receitas:** 'Vendas', 'Serviços', 'Investimentos', 'Aportes'.
       - **Despesas Operacionais:** 'Fornecedores', 'Marketing', 'Software/SaaS', 'Aluguel', 'Impostos (DAS, GPS)'.
       - **Despesas Pessoais:** 'Alimentação', 'Saúde', 'Transporte', 'Lazer'.
       - **Financeiro:** 'Tarifas Bancárias', 'Juros Empréstimo'.
    4. **Mapeamento de Tipos:** 
       - Créditos/Entradas -> 'INCOME'.
       - Débitos/Saídas/Pagamentos -> 'EXPENSE'.
    5. **Status:** 
       - Extratos bancários e recibos antigos -> 'PAID'.
       - Faturas futuras ou boletos -> 'PENDING'.

    ## 🏗️ LÓGICA DE EXTRAÇÃO EM MASSA (EXTRATOS)
    Se o documento for um extrato (PDF/OFX) com múltiplas linhas:
    - Extraia **CADA** linha como uma transação individual no array 'extractedTransactions'.
    - Aglutine transações apenas se forem repetições idênticas no mesmo dia (ex: múltiplas taxas de 1,00).

    ## 📝 FORMATO DE SAÍDA (JSON OBRIGATÓRIO)
    Ignore conversas triviais se houver um documento. Priorize o JSON.
    \`\`\`json
    {
      "textResponse": "Resumo do que foi encontrado (ex: 'Detectado Extrato Nubank com 15 lançamentos.')",
      "extractedTransactions": [ 
        {
          "description": "Nome limpo do favorecido ou transação",
          "amount": 100.50,
          "date": "YYYY-MM-DD",
          "type": "EXPENSE" | "INCOME",
          "category": "Categoria Sugerida",
          "status": "PAID",
          "scope": "BUSINESS" | "PERSONAL"
        }
      ],
      "updates": [ { "id": "uuid", "fields": { "status": "PAID" } } ],
      "deletions": [ "uuid" ],
      "extractedClients": [ ... ]
    }
    \`\`\`
`;

/**
 * Analisa a entrada financeira do usuário usando Gemini AI.
 * Suporta entrada multimodal (texto + arquivos/imagens) e contexto de banco de dados.
 */
export const analyzeFinancialInput = async (
  input: string, 
  attachment?: Attachment, 
  lang: Language = 'pt',
  dbContext?: string,
  chatHistory: any[] = []
): Promise<{
  textResponse: string;
  extractedTransactions?: Partial<Transaction>[];
  updates?: { id: string; fields: Partial<Transaction> }[];
  deletions?: string[];
  extractedClients?: Partial<NfseClient>[];
}> => {
  try {
    const provider = localStorage.getItem('chat_provider') || 'GEMINI';
    
    if (provider === 'OPENAI') {
      const apiKey = loadSecureSetting('openai_key');
      const modelName = localStorage.getItem('openai_model') || 'gpt-4o';
      
      if (!apiKey) {
        throw new Error("API Key do OpenAI não configurada no Admin Settings.");
      }

      const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
      
      const messages: any[] = [
        { role: 'system', content: SYSTEM_PROMPT }
      ];

      const now = new Date();
      const dateContext = `[Data/Hora Atual]: ${now.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
      messages.push({ role: 'system', content: dateContext });

      if (dbContext) messages.push({ role: 'system', content: `[Contexto DB]: ${dbContext}` });
      
      chatHistory.forEach(msg => {
        // Converte o formato do Gemini para o do OpenAI se necessário
        const content = msg.parts ? msg.parts[0].text : msg.content;
        messages.push({ role: msg.role === 'model' ? 'assistant' : msg.role, content });
      });

      const userContent: any[] = [{ type: 'text', text: input }];
      if (attachment) {
        userContent.push({
          type: 'image_url',
          image_url: { url: attachment.data }
        });
      }
      messages.push({ role: 'user', content: userContent });

      const response = await openai.chat.completions.create({
        model: modelName,
        messages,
        response_format: { type: "text" }
      });

      const rawText = response.choices[0].message.content || '';
      return processAIResponse(rawText);
    } else {
      // GEMINI FLOW
      const overrideKey = loadSecureSetting('gemini_key');
      const overrideModel = localStorage.getItem('gemini_model');
      const apiKey = overrideKey || process.env.GEMINI_API_KEY;
      const modelName = overrideModel || "gemini-3-flash-preview";
      
      if (!apiKey) {
        throw new Error("API Key do Gemini não configurada no Admin Settings ou Variáveis de Ambiente.");
      }

      const ai = new GoogleGenAI({ apiKey });
      const now = new Date();
      const dateContext = `[Data/Hora Atual]: ${now.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
      
      const parts: any[] = [{ text: input }];
      parts.push({ text: dateContext });
      
      if (dbContext) parts.push({ text: `[Contexto DB]: ${dbContext}` });
      
      if (attachment) {
        const base64Data = attachment.data.includes('base64,') ? attachment.data.split(',')[1] : attachment.data;
        parts.push({ inlineData: { mimeType: attachment.mimeType, data: base64Data } });
      }

      const contents = [...chatHistory, { role: 'user', parts }];

      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: { systemInstruction: SYSTEM_PROMPT }
      });

      const rawText = response.text || "";
      return processAIResponse(rawText);
    }
  } catch (error: any) {
    console.error("AI Analysis Error:", error);
    return { textResponse: `⚠️ Falha na análise inteligente: ${error.message}` };
  }
};

/**
 * Processa a resposta bruta da IA para extrair JSON e texto limpo.
 */
const processAIResponse = (rawText: string) => {
  let cleanTextResponse = rawText;
  let extractedTransactions = [];
  let updates = [];
  let deletions = [];
  let extractedClients = [];

  const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed && typeof parsed === 'object') {
        extractedTransactions = parsed.extractedTransactions || [];
        updates = parsed.updates || [];
        deletions = parsed.deletions || [];
        extractedClients = parsed.extractedClients || [];
        cleanTextResponse = rawText.replace(/```json[\s\S]*?```/, "").trim();
      }
    } catch (e) {
      console.error("Erro ao processar JSON da IA:", e);
    }
  }

  return { textResponse: cleanTextResponse, extractedTransactions, updates, deletions, extractedClients };
};

/**
 * Método genérico para geração de texto/chat sem processamento financeiro específico.
 */
export const generateChatResponse = async (prompt: string, history: any[] = []): Promise<string> => {
  try {
    const overrideKey = loadSecureSetting('gemini_key');
    const apiKey = overrideKey || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Chave Gemini não configurada");

    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ 
        role: 'user', 
        parts: [{ text: `Aja como um especialista em E-commerce e Copywriting. Pesquise na internet tudo sobre o produto: "${prompt}" e crie uma descrição completa com SEO e Gatilhos Mentais.

Use EXATAMENTE este modelo de estrutura:
1. ✨ Título Chamativo (com emojis)
2. Frase de impacto sobre o benefício principal
3. Parágrafo curto de introdução
4. 💜 Benefícios Principais (use emojis)
5. 🔮 Design e Qualidade (detalhado)
6. 💰 Diferenciais de Valor
7. 📏 Especificações Técnicas (em lista)
8. ⚠️ Observações importantes (como variações naturais)
9. 🌿 Resumo final e CTA (Call to Action)

Retorne APENAS o texto da descrição finalizada, formatada e pronta para uso, sem comentários extras.` }] 
      }],
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text || "Sem resposta";
    return text.trim();
  } catch (error: any) {
    console.error("Gemini Generic Error:", error);
    return `Erro ao gerar resposta: ${error.message}`;
  }
};

/**
 * Testa a conexão com o Gemini API.
 */
export const testGeminiConnection = async (apiKey: string): Promise<{ success: boolean; message?: string }> => {
  try {
    if (!apiKey) return { success: false, message: "API Key não fornecida" };
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({ 
      model: "gemini-3-flash-preview", 
      contents: "Olá, responda apenas 'OK' se estiver funcionando." 
    });
    return { success: true, message: response.text };
  } catch (error: any) {
    console.error("Gemini Test Error:", error);
    return { success: false, message: error.message || "Erro desconhecido na conexão" };
  }
};
