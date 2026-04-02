
// services/geminiService.ts

import { GoogleGenAI } from "@google/genai";
import { Transaction, Language, NfseClient } from "../types";

export interface Attachment {
  mimeType: string;
  data: string;
}

const SYSTEM_PROMPT = `
    ## 🤖 PERFIL: GERENTE FINANCEIRO SÊNIOR & ESPECIALISTA EM OCR (BRASIL)
    Seu objetivo é o controle rigoroso de fluxo de caixa, gestão contábil e extração precisa de dados de documentos financeiros brasileiros.
    
    ## 📸 DIRETRIZES DE OCR (RECIBOS, NOTAS FISCAIS, COMPROVANTES)
    Ao receber imagens ou PDFs de recibos, cupons fiscais (DANFE, NFC-e) ou comprovantes de transferência (Pix, TED):
    - Extraia o valor total ('amount') com precisão decimal. Remova símbolos de moeda (R$).
    - Identifique a data da transação ('date') no formato ISO YYYY-MM-DD. Se encontrar apenas "hoje", use a data atual.
    - Identifique o nome do estabelecimento, fornecedor ou emissor para a 'description'.
    - Classifique automaticamente em uma 'category' lógica baseada no mercado brasileiro (ex: Alimentação, Transporte, Suprimentos, Saúde, Lazer, Educação).
    - Defina 'type' como 'EXPENSE' para compras/pagamentos e 'INCOME' para recebimentos/vendas.
    - Defina 'status' como 'PAID' para recibos de compras já realizadas ou comprovantes de transferência concluídos.
    - Defina 'scope' como 'BUSINESS' (PJ) se houver CNPJ ou nome de empresa, ou 'PERSONAL' (PF) se parecer um gasto individual.
    - Se houver múltiplos itens, tente consolidar no valor total, mas mencione os itens principais na 'description' se relevante.

    ## 📏 DIRETRIZES GERAIS
    - Respostas concisas e estruturadas.
    - Reconheça 'PAID' como liquidado.
    - Gere JSON para transações, atualizações e novos clientes.

    ## 📝 FORMATO DE SAÍDA (JSON OBRIGATÓRIO)
    \`\`\`json
    {
      "extractedTransactions": [ 
        {
          "description": "string",
          "amount": number,
          "date": "YYYY-MM-DD",
          "type": "EXPENSE" | "INCOME",
          "category": "string",
          "status": "PAID" | "PENDING",
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
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const parts: any[] = [{ text: input }];
    
    if (dbContext) parts.push({ text: `[Contexto DB]: ${dbContext}` });
    
    if (attachment) {
      const base64Data = attachment.data.includes('base64,') ? attachment.data.split(',')[1] : attachment.data;
      parts.push({ inlineData: { mimeType: attachment.mimeType, data: base64Data } });
    }

    // Prepara os conteúdos incluindo o histórico de chat para manter o contexto da conversa
    const contents = [...chatHistory, { role: 'user', parts }];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: { systemInstruction: SYSTEM_PROMPT }
    });

    const rawText = response.text || "";
    let extractedTransactions = [];
    let updates = [];
    let deletions = [];
    let extractedClients = [];
    let cleanTextResponse = rawText;

    const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        extractedTransactions = parsed.extractedTransactions || [];
        updates = parsed.updates || [];
        deletions = parsed.deletions || [];
        extractedClients = parsed.extractedClients || [];
        cleanTextResponse = rawText.replace(/```json[\s\S]*?```/, "").trim();
      } catch (e) {
        console.error("Erro ao processar JSON da IA:", e);
      }
    }

    return { textResponse: cleanTextResponse, extractedTransactions, updates, deletions, extractedClients };
  } catch (error: any) {
    return { textResponse: `⚠️ Falha na análise inteligente: ${error.message}` };
  }
};

/**
 * Testa a conexão com o Gemini API.
 */
export const testGeminiConnection = async (apiKey: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: "test" });
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};
