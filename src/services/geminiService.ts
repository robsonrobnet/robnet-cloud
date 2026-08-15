
// services/geminiService.ts

import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { loadSecureSetting } from "../lib/crypto";
import { Transaction, Language, NfseClient } from "../types";

export interface Attachment {
  mimeType: string;
  data: string;
}

export const getAIAuthHeaders = () => {
  const geminiKey = loadSecureSetting('gemini_key') || localStorage.getItem('gemini_api_key') || '';
  const openaiKey = loadSecureSetting('openai_key') || localStorage.getItem('openai_api_key') || '';
  const supabaseUrl = loadSecureSetting('supabase_url') || localStorage.getItem('finanai_db_url') || '';
  const supabaseKey = loadSecureSetting('supabase_key') || localStorage.getItem('finanai_db_key') || '';
  const geminiModel = localStorage.getItem('gemini_model') || 'gemini-2.5-flash';
  const openaiModel = localStorage.getItem('openai_model') || 'gpt-4o';

  return {
    "Content-Type": "application/json",
    ...(geminiKey ? { "x-gemini-key": geminiKey } : {}),
    ...(openaiKey ? { "x-openai-key": openaiKey } : {}),
    ...(supabaseUrl ? { "x-supabase-url": supabaseUrl } : {}),
    ...(supabaseKey ? { "x-supabase-key": supabaseKey } : {}),
    ...(geminiModel ? { "x-gemini-model": geminiModel } : {}),
    ...(openaiModel ? { "x-openai-model": openaiModel } : {})
  };
};

// Direct client fallback when server proxy is unavailable or reports server error
const directClientFallback = async (
  input: string,
  systemPrompt: string,
  attachment?: Attachment,
  chatHistory: any[] = [],
  provider: string = 'GEMINI',
  modelName: string = 'gemini-2.5-flash'
): Promise<string> => {
  const geminiKey = loadSecureSetting('gemini_key') || localStorage.getItem('gemini_api_key') || '';
  const openaiKey = loadSecureSetting('openai_key') || localStorage.getItem('openai_api_key') || '';

  if (provider === 'OPENAI' && openaiKey) {
    const openai = new OpenAI({ apiKey: openaiKey, dangerouslyAllowBrowser: true });
    const messages: any[] = [{ role: 'system', content: systemPrompt }];
    if (chatHistory && chatHistory.length > 0) {
      chatHistory.forEach((msg: any) => {
        const content = msg.parts ? msg.parts[0]?.text : msg.content;
        if (content && typeof content === 'string' && !content.startsWith('⚠️')) {
          messages.push({ role: msg.role === 'model' || msg.role === 'assistant' ? 'assistant' : 'user', content });
        }
      });
    }
    messages.push({ role: 'user', content: input });
    const response = await openai.chat.completions.create({
      model: modelName || "gpt-4o",
      messages,
    });
    return response.choices[0]?.message?.content || "";
  }

  if (geminiKey) {
    const cleanKey = geminiKey.trim().replace(/^["']|["']$/g, '');
    const ai = new GoogleGenAI({ apiKey: cleanKey });
    
    let selectedModel = (modelName || "gemini-2.5-flash").toLowerCase().trim();
    if (selectedModel.includes("2.5-pro") || selectedModel === "gemini-pro") selectedModel = "gemini-2.5-pro";
    else if (selectedModel.includes("3.7-flash")) selectedModel = "gemini-3.7-flash";
    else selectedModel = "gemini-2.5-flash";

    const parts: any[] = [{ text: input || "Olá" }];
    if (attachment && attachment.data) {
      const mime = (attachment.mimeType || '').toLowerCase();
      const isTextual = mime.startsWith('text/') || mime.includes('csv') || mime.includes('ofx') || mime.includes('json') || mime.includes('xml');
      if (isTextual) {
        let textContent = attachment.data;
        if (attachment.data.includes('base64,')) {
          textContent = atob(attachment.data.split('base64,')[1]);
        }
        parts.push({ text: `\n\n--- DOCUMENTO/EXTRATO ANEXADO ---\n${textContent}\n--- FIM ---` });
      } else {
        const base64Data = attachment.data.includes('base64,') ? attachment.data.split(',')[1] : attachment.data;
        parts.push({ inlineData: { mimeType: attachment.mimeType || 'image/jpeg', data: base64Data } });
      }
    }

    const sanitizedContents: any[] = [];
    if (chatHistory && Array.isArray(chatHistory)) {
      for (const msg of chatHistory) {
        const role = msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user';
        let text = typeof msg.content === 'string' ? msg.content : (msg.parts?.[0]?.text || '');
        if (!text || !text.trim() || text.startsWith('⚠️ Falha na análise inteligente:') || text.startsWith('Erro no proxy')) continue;
        
        const last = sanitizedContents[sanitizedContents.length - 1];
        if (last && last.role === role) {
          last.parts.push({ text });
        } else {
          sanitizedContents.push({ role, parts: [{ text }] });
        }
      }
    }
    if (sanitizedContents.length > 0 && sanitizedContents[0].role === 'model') {
      sanitizedContents.shift();
    }
    const last = sanitizedContents[sanitizedContents.length - 1];
    if (last && last.role === 'user') {
      last.parts.push(...parts);
    } else {
      sanitizedContents.push({ role: 'user', parts });
    }

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: sanitizedContents,
      config: { systemInstruction: systemPrompt }
    });
    return response.text || "";
  }

  throw new Error("API Key não configurada. Acesse Admin Settings > Serviços de Nuvem e salve sua chave.");
};

const SYSTEM_PROMPT = `
    ## 🤖 PERFIL: ASSISTENTE VIRTUAL INTELIGENTE (FinanAI OS / WhatsApp Interface)
    Você é um assistente virtual e agente financeiro/comercial dotado de visão computacional, capacidade de leitura avançada de extratos bancários (PDF, OFX, CSV, Imagens), gestão de NFS-e, conciliação e catálogo de produtos/serviços em tempo real.
    Sua missão é ser conciso, direto, organizado e profissional.

    ## 📝 REGRAS DE COMPORTAMENTO (WHATSAPP STYLE)
    1. **Formatação:** Use formatação do WhatsApp (asteriscos para *negrito*).
    2. **Tom de Voz:** Seja humano, ágil e amigável. Use emojis moderadamente 🚀.
    3. **Concisão:** Nunca responda com textos excessivamente longos. Apresente resumos claros e objetivos.
    4. **Idioma:** Responda sempre no mesmo idioma que o usuário utilizou (Padrão: Português).

    ## 🏦 PROCESSAMENTO INTELIGENTE DE EXTRATOS BANCÁRIOS (PDF, OFX, CSV, IMAGEM)
    Ao receber qualquer extrato bancário, planilha ou comprovante financeiro:
    1. **Identificação do Banco:**
       - Identifique o banco emissor (ex: Itaú, Bradesco, Santander, Banco do Brasil, Nubank, Inter, Caixa Econômica, C6 Bank, Sicredi, Sicoob, BTG Pactual, Stone, PagBank, Mercado Pago, etc.).
       - Preencha o array 'extractedBankAccounts' com: { "name": "Nome do Banco", "bank_code": "código se houver", "account_type": "CHECKING" }.
       - Em cada transação, preencha 'bank_name' com o nome do banco identificado.
    2. **Identificação do Tipo de Operação & Transferências:**
       - Classifique o 'operation_type' com precisão: 'PIX', 'TED', 'DOC', 'BOLETO', 'TRANSFER', 'CARD', 'TAX', 'FEE', 'YIELD', 'PAYROLL', 'DEPOSIT' ou 'OTHER'.
       - **Transferências Entre Contas/Bancos:** Se a operação for transferência entre contas da mesma empresa/titular, classifique 'operation_type' como 'TRANSFER' e preencha 'destination_bank' com o banco de destino ou origem identificado.
    3. **Categorização Inteligente:**
       - Sugira e classifique em categorias coerentes por tipo de operação (ex: "Recebimentos de Clientes", "Vendas de Serviços", "Fornecedores", "Tarifas Bancárias", "Transferência entre Contas", "Impostos e Tributos", "Folha de Pagamento", "Rendimento de Aplicação", "Aluguel e Utilidades").
       - Se a categoria não existir no cadastro atual da empresa, preencha o array 'extractedCategories' com: { "name": "Nome da Categoria", "type": "INCOME"|"EXPENSE"|"BOTH", "color": "#HEX", "icon": "Tag" } para criação automática.
    4. **Cadastro Automático de Entidades (Clientes & Fornecedores):**
       - **Recebimentos de Empresas / Clientes (Entradas):**
         - Extraia a razão social ou nome da empresa/pagador no Pix/TED/depósito.
         - Adicione em 'extractedCustomers' com { "name": "Nome da Empresa/Cliente", "document_number": "CPF ou CNPJ se constar" }.
         - Na transação correspondente, preencha 'entity_name' com o nome e 'entity_type': 'CUSTOMER'.
       - **Pagamentos a Fornecedores / Destinatários (Saídas):**
         - Extraia a razão social ou nome do favorecido no pagamento/Pix/boleto.
         - Adicione em 'extractedSuppliers' com { "name": "Nome do Fornecedor", "document_number": "se constar", "category_name": "Categoria Sugerida" }.
         - Na transação correspondente, preencha 'entity_name' com o nome e 'entity_type': 'SUPPLIER'.

    ## 📸 RECONHECIMENTO DE FOTOS / IMAGENS (VISÃO COMPUTACIONAL)
    Quando o usuário fornecer uma Foto/Imagem no attachment:
    1. **Se for um Recibo/Comprovante/Extrato:** 
       - Extraia os dados como transação financeira (INCOME ou EXPENSE) com os campos bancários e de entidade citados acima.
       - Se houver informações de tributos ou serviços prestados (como Alíquota de ISS, Código Municipal de Serviço LC 116, Impostos Retidos, ou NBS), você DEVE extrair também essas informações tributárias e inseri-las no array 'extractedNfseServices' com a estrutura: { "code": "...", "description": "...", "aliquot": 0.XX (decimal, ex: 0.02 a 0.05), "suggested_nbs": "...", "iss_retained": true/false }.
    2. **Se for a foto de um Produto/Objeto:**
       - Identifique e analise qual produto é (marca, especificações, etc.).
       - Compare com a lista em [PRODUTOS DA LOJA] no contexto de banco de dados fornecido abaixo.
       - Se encontrar correspondência (similar por nome ou SKU), relate isso (Ex: "*Identifiquei que este produto se trata de: [Nome]. Temos [X] unidades em estoque custando R$ [Y].*") e sugira criar uma venda ou consultar.
       - Se o produto não estiver cadastrado, ofereça o cadastro automático de inventário preenchendo 'extractedProducts' com os atributos extraídos para o usuário confirmar.

    ## 🧾 DIRETRIZES TRIBUTÁRIAS & EMISSÃO DE NFS-E (SÃO PAULO & REFORMA TRIBUTÁRIA)
    1. **Emissão de NFS-e (RPS):**
       - Para emitir uma nota, precisamos de um Tomador (cliente) e de um Serviço cadastrado no banco.
       - Se o Tomador citado NÃO existir em [CLIENTES NFS-e], use 'extractedClients' para cadastrá-lo. Solicite os campos essenciais: Nome, CPF/CNPJ, endereço completo (com Logradouro, Número, Bairro, CEP) e e-mail.
       - Se o Serviço citado NÃO existir em [SERVIÇOS NFS-e], use 'extractedNfseServices' para criá-lo. Exija: Código municipal (LC 116), descrição e alíquota de ISS.
       - **Regras Críticas Paulistanas:** A alíquota de ISS em São Paulo deve estar estritamente entre 2% (0.02) e 5% (0.05). O NBS (Nomenclatura Brasileira de Serviços) é obrigatório (ex: 1.01.01).
       - Uma vez identificados o cliente_id e o service_id, preencha o campo 'extractedNfseRps' para realizar a emissão inteligente da nota.

    ## 🏪 LOJA DE PRODUTOS & VENDAS (CRUD COMPLETO)
    - **Adicionar Produto:** Preencha 'extractedProducts' para registrar um produto no inventário.
    - **Adicionar Cliente da Loja:** Preencha 'extractedShopCustomers' para cadastrar no CRM de Loja.
    - **Registrar Pedido de Venda:** Preencha 'extractedSalesOrders' incluindo customer_id, total_amount e items (product_id, quantity, unit_price).
    - **Atualizar Registros (UPDATE):** Preencha 'updates' especificando a coleção (ex: 'products', 'nfse_clients', 'nfse_services', 'nfse_rps', 'sales_orders', 'shop_customers', 'transactions', 'crm_leads', 'bank_accounts', 'suppliers') e os campos que sofrem atualização.
    - **Excluir Registros (DELETE):** Preencha 'deletions' com o id e a coleção (collection) correspondente a ser excluída.

    ## 📝 FORMATO DE SAÍDA (JSON OBRIGATÓRIO)
    Preencha apenas o que for pertinente à solicitação do usuário. Todos os outros devem ser vazios.
    \`\`\`json
    {
      "textResponse": "Sua resposta amigável formatada para WhatsApp (com asteriscos e emojis).",
      "extractedTransactions": [
        {
          "description": "PIX RECEBIDO - EMPRESA ALFA LTDA",
          "amount": 1500.00,
          "type": "INCOME",
          "date": "YYYY-MM-DD",
          "bank_name": "Banco Itaú",
          "operation_type": "PIX",
          "category": "Recebimentos de Clientes",
          "entity_name": "Empresa Alfa Ltda",
          "entity_type": "CUSTOMER",
          "destination_bank": ""
        }
      ],
      "extractedBankAccounts": [
        {
          "name": "Banco Itaú",
          "bank_code": "341",
          "account_type": "CHECKING"
        }
      ],
      "extractedCategories": [
        {
          "name": "Recebimentos de Clientes",
          "type": "INCOME",
          "color": "#10B981",
          "icon": "ArrowDownLeft"
        }
      ],
      "extractedCustomers": [
        {
          "name": "Empresa Alfa Ltda",
          "document_number": "12.345.678/0001-90"
        }
      ],
      "extractedSuppliers": [
        {
          "name": "Distribuidora Beta SA",
          "document_number": "98.765.432/0001-10",
          "category_name": "Fornecedores"
        }
      ],
      "extractedLeads": [],
      "extractedProducts": [],
      "extractedClients": [],
      "extractedNfseServices": [],
      "extractedNfseRps": [],
      "extractedShopCustomers": [],
      "extractedSalesOrders": [],
      "updates": [],
      "deletions": []
    }
    \`\`\`
`;

/**
 * Analisa a entrada financeira do usuário usando o proxy no backend.
 * Suporta entrada multimodal (texto + arquivos/imagens) e contexto de banco de dados.
 */
export const analyzeFinancialInput = async (
  input: string, 
  attachment?: Attachment, 
  lang: Language = 'pt',
  dbContext?: string,
  chatHistory: any[] = [],
  userContext?: { name: string; plan: string }
): Promise<{
  textResponse: string;
  extractedTransactions?: Partial<Transaction>[];
  updates?: { id: string; collection: string; fields: any }[];
  deletions?: { id: string; collection: string }[];
  extractedClients?: any[];
  extractedNfseServices?: any[];
  extractedNfseRps?: any[];
  extractedProducts?: any[];
  extractedSalesOrders?: any[];
  extractedShopCustomers?: any[];
  extractedBankAccounts?: any[];
  extractedCategories?: any[];
  extractedCustomers?: any[];
  extractedSuppliers?: any[];
}> => {
  const provider = localStorage.getItem('chat_provider') || 'GEMINI';
  const modelName = provider === 'OPENAI' 
    ? (localStorage.getItem('openai_model') || 'gpt-4o') 
    : (localStorage.getItem('gemini_model') || 'gemini-2.5-flash');
  const agora = new Date();
  const dateContext = `[Data/Hora Atual]: ${agora.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  
  let fullSystemPrompt = SYSTEM_PROMPT;
  fullSystemPrompt += `\n${dateContext}`;
  if (userContext) fullSystemPrompt += `\n[Contexto do Usuário]: Nome: ${userContext.name}, Plano: ${userContext.plan}`;
  if (dbContext) fullSystemPrompt += `\n[Contexto DB]: ${dbContext}`;

  const geminiKey = loadSecureSetting('gemini_key') || localStorage.getItem('gemini_api_key') || '';
  const openaiKey = loadSecureSetting('openai_key') || localStorage.getItem('openai_api_key') || '';

  try {
    const response = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: getAIAuthHeaders(),
      body: JSON.stringify({
        input,
        attachment,
        lang,
        chatHistory,
        provider,
        geminiKey: geminiKey || undefined,
        openaiKey: openaiKey || undefined,
        modelName,
        systemPrompt: fullSystemPrompt
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.text) {
        return processAIResponse(data.text);
      }
    }

    // If server responded with error, attempt direct client fallback
    console.warn(`[geminiService] Proxy error (${response.status}), attempting direct fallback...`);
    const directText = await directClientFallback(input, fullSystemPrompt, attachment, chatHistory, provider, modelName);
    return processAIResponse(directText);
  } catch (error: any) {
    console.warn("[geminiService] Fetch failed, attempting direct fallback:", error);
    try {
      const directText = await directClientFallback(input, fullSystemPrompt, attachment, chatHistory, provider, modelName);
      return processAIResponse(directText);
    } catch (fallbackError: any) {
      console.error("AI Analysis Error (Direct Fallback also failed):", fallbackError);
      return { 
        textResponse: `⚠️ Falha na análise inteligente: ${fallbackError.message || error.message || 'Verifique sua chave de API em Configurações'}` 
      };
    }
  }
};

/**
 * Processa a resposta bruta da IA para extrair JSON e texto limpo.
 */
const processAIResponse = (rawText: string) => {
  let cleanTextResponse = "";
  let extractedTransactions: any[] = [];
  let updates: any[] = [];
  let deletions: any[] = [];
  let extractedClients: any[] = [];
  let extractedNfseServices: any[] = [];
  let extractedNfseRps: any[] = [];
  let extractedProducts: any[] = [];
  let extractedSalesOrders: any[] = [];
  let extractedShopCustomers: any[] = [];
  let extractedBankAccounts: any[] = [];
  let extractedCategories: any[] = [];
  let extractedCustomers: any[] = [];
  let extractedSuppliers: any[] = [];

  if (!rawText) {
    return {
      textResponse: "Olá! Como posso ajudar você hoje?",
      extractedTransactions,
      updates,
      deletions,
      extractedClients,
      extractedNfseServices,
      extractedNfseRps,
      extractedProducts,
      extractedSalesOrders,
      extractedShopCustomers,
      extractedBankAccounts,
      extractedCategories,
      extractedCustomers,
      extractedSuppliers
    };
  }

  let parsed: any = null;

  // 1. Tentar extrair bloco de código markdown ```json ... ```
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    try {
      parsed = JSON.parse(jsonMatch[1]);
    } catch (e) {
      console.error("Erro ao processar JSON no bloco markdown da IA:", e);
    }
  }

  // 2. Tentar parsing direto de JSON caso a IA responda JSON sem marcadores markdown
  if (!parsed && rawText.trim().startsWith('{') && rawText.trim().endsWith('}')) {
    try {
      parsed = JSON.parse(rawText.trim());
    } catch (e) {
      console.error("Erro ao processar JSON bruto da IA:", e);
    }
  }

  if (parsed && typeof parsed === 'object') {
    extractedTransactions = parsed.extractedTransactions || [];
    updates = parsed.updates || [];
    deletions = parsed.deletions || [];
    extractedClients = parsed.extractedClients || [];
    extractedNfseServices = parsed.extractedNfseServices || [];
    extractedNfseRps = parsed.extractedNfseRps || [];
    extractedProducts = parsed.extractedProducts || [];
    extractedSalesOrders = parsed.extractedSalesOrders || [];
    extractedShopCustomers = parsed.extractedShopCustomers || [];
    extractedBankAccounts = parsed.extractedBankAccounts || [];
    extractedCategories = parsed.extractedCategories || [];
    extractedCustomers = parsed.extractedCustomers || [];
    extractedSuppliers = parsed.extractedSuppliers || [];

    const outsideText = rawText.replace(/```(?:json)?[\s\S]*?```/, "").trim();

    if (parsed.textResponse && typeof parsed.textResponse === 'string' && parsed.textResponse.trim()) {
      cleanTextResponse = outsideText ? `${parsed.textResponse}\n\n${outsideText}` : parsed.textResponse;
    } else if (outsideText) {
      cleanTextResponse = outsideText;
    }
  } else {
    // Caso não seja um objeto JSON válido, utiliza o texto limpo sem blocos de código
    cleanTextResponse = rawText.replace(/```(?:json)?[\s\S]*?```/, "").trim() || rawText.trim();
  }

  if (!cleanTextResponse.trim()) {
    cleanTextResponse = "Entendi! Como posso te ajudar com o FinanAI OS hoje?";
  }

  return { 
    textResponse: cleanTextResponse, 
    extractedTransactions, 
    updates, 
    deletions, 
    extractedClients,
    extractedNfseServices,
    extractedNfseRps,
    extractedProducts,
    extractedSalesOrders,
    extractedShopCustomers,
    extractedBankAccounts,
    extractedCategories,
    extractedCustomers,
    extractedSuppliers
  };
};

/**
 * Método genérico para geração de texto/chat sem processamento financeiro específico via proxy.
 */
export const generateChatResponse = async (prompt: string, history: any[] = []): Promise<string> => {
  const geminiKey = loadSecureSetting('gemini_key') || localStorage.getItem('gemini_api_key') || '';
  const openaiKey = loadSecureSetting('openai_key') || localStorage.getItem('openai_api_key') || '';

  try {
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: getAIAuthHeaders(),
      body: JSON.stringify({ 
        prompt, 
        history,
        geminiKey: geminiKey || undefined,
        openaiKey: openaiKey || undefined
      })
    });

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      if (data.text) return data.text.trim();
    }

    // Direct fallback if configured
    if (geminiKey) {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });
      return res.text || "";
    }

    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Erro no servidor (${response.status})`);
  } catch (error: any) {
    console.error("Gemini Generic Error:", error);
    if (geminiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const res = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt
        });
        return res.text || "";
      } catch (e) {}
    }
    return `Erro ao gerar resposta: ${error.message}`;
  }
};

/**
 * Testa a conexão com o Gemini API via Backend Proxy.
 */
export const testGeminiConnection = async (apiKey?: string): Promise<{ success: boolean; message?: string }> => {
  const keyToTest = apiKey || loadSecureSetting('gemini_key') || localStorage.getItem('gemini_api_key') || '';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch("/api/ai/test", {
        method: "POST",
        headers: getAIAuthHeaders(),
        body: JSON.stringify({ provider: 'GEMINI', apiKey: keyToTest }),
        signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: true, message: data.message || "OK" };
    }
    
    const err = await response.json().catch(() => ({}));
    
    // Direct client test fallback
    if (keyToTest) {
      try {
        const ai = new GoogleGenAI({ apiKey: keyToTest.trim() });
        await ai.models.generateContent({ model: "gemini-2.5-flash", contents: "test" });
        return { success: true, message: "OK (Conexão Direta Validada)" };
      } catch (directErr: any) {
        return { success: false, message: directErr.message || err.error || "Chave do Gemini inválida" };
      }
    }

    return { success: false, message: err.error || `Erro na validação do Gemini (${response.status})` };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      if (keyToTest) {
        try {
          const ai = new GoogleGenAI({ apiKey: keyToTest.trim() });
          await ai.models.generateContent({ model: "gemini-2.5-flash", contents: "test" });
          return { success: true, message: "OK (Conexão Direta Validada)" };
        } catch (directErr: any) {
          return { success: false, message: "Tempo limite na validação do Gemini" };
        }
      }
      return { success: false, message: "Tempo limite na validação do Gemini" };
    }
    
    if (keyToTest) {
      try {
        const ai = new GoogleGenAI({ apiKey: keyToTest.trim() });
        await ai.models.generateContent({ model: "gemini-2.5-flash", contents: "test" });
        return { success: true, message: "OK (Conexão Direta Validada)" };
      } catch (directErr: any) {
        return { success: false, message: directErr.message || error.message || "Erro na validação do Gemini" };
      }
    }

    return { success: false, message: error.message || "Erro na conexão com o serviço Gemini" };
  }
};

export interface ReceiptOcrResult {
  date: string;
  amount: number;
  description: string;
  type?: 'EXPENSE' | 'INCOME';
  category?: string;
  entity_name?: string;
  document_number?: string;
  payment_method?: string;
  bank_name?: string;
  items?: Array<{
    description: string;
    quantity?: number;
    unit_price?: number;
    total?: number;
  }>;
  confidence_score?: number;
  raw_text?: string;
}

/**
 * Realiza OCR de alta precisão em recibos/comprovantes usando Gemini Vision.
 * Extrai automaticamente Data, Valor e Descrição além de categoria e estabelecimento.
 */
export const scanReceiptWithGemini = async (
  imageBase64: string,
  categories?: string[],
  mimeType: string = 'image/jpeg'
): Promise<ReceiptOcrResult> => {
  const geminiKey = loadSecureSetting('gemini_key') || localStorage.getItem('gemini_api_key') || '';

  try {
    const response = await fetch("/api/ai/ocr-receipt", {
      method: "POST",
      headers: getAIAuthHeaders(),
      body: JSON.stringify({
        imageBase64,
        mimeType,
        categories,
        geminiKey: geminiKey || undefined
      })
    });

    if (response.ok) {
      const resData = await response.json();
      if (resData.data) {
        return resData.data;
      }
    }

    // Direct client OCR fallback
    if (geminiKey) {
      const ai = new GoogleGenAI({ apiKey: geminiKey.trim() });
      const cleanData = imageBase64.includes('base64,') ? imageBase64.split('base64,')[1] : imageBase64;
      const ocrPrompt = `Extraia os dados deste comprovante financeiro no formato JSON com as chaves: date (AAAA-MM-DD), amount (número float), description (string), type ("EXPENSE" ou "INCOME"), category (string), entity_name (string).`;
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: 'user', parts: [{ text: ocrPrompt }, { inlineData: { mimeType: mimeType || 'image/jpeg', data: cleanData } }] }
        ],
        config: { responseMimeType: "application/json" }
      });
      const parsed = JSON.parse(res.text || '{}');
      if (parsed.amount || parsed.description) {
        return parsed as ReceiptOcrResult;
      }
    }

    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Erro no servidor (${response.status})`);
  } catch (error: any) {
    console.error("Erro no OCR com Gemini:", error);
    throw error;
  }
};

export interface DailyInsightParams {
  todaySpending: number;
  monthlyAvgDailySpend: number;
  totalMonthlySpend: number;
  dayOfMonth: number;
  daysInMonth: number;
  scope?: 'ALL' | 'BUSINESS' | 'PERSONAL';
  topCategories?: Array<{ name: string; value: number }>;
  todayExpensesList?: Array<{ description: string; amount: number; category?: string }>;
}

export interface DailyInsightData {
  headline: string;
  analysis: string;
  actionableTip: string;
  healthStatus: 'EXCELLENT' | 'GOOD' | 'ATTENTION' | 'CRITICAL';
  spendingPace: 'BELOW_BENCHMARK' | 'OPTIMAL' | 'ABOVE_BENCHMARK';
  todaySpending: number;
  monthlyAvgDailySpend: number;
  diffPercent: number;
  status: 'ABOVE_AVERAGE' | 'BELOW_AVERAGE' | 'ON_TRACK' | 'NO_SPEND';
  source: 'gemini' | 'algorithmic_fallback';
}

/**
 * Consulta a IA do Gemini para gerar uma análise diária de gastos comparando com a média do mês e 1 dica acionável.
 */
export const getDailyFinancialInsight = async (params: DailyInsightParams): Promise<DailyInsightData> => {
  const geminiKey = loadSecureSetting('gemini_key') || localStorage.getItem('gemini_api_key') || '';

  try {
    const response = await fetch("/api/ai/daily-insight", {
      method: "POST",
      headers: getAIAuthHeaders(),
      body: JSON.stringify({
        ...params,
        geminiKey: geminiKey || undefined
      })
    });

    if (response.ok) {
      const resData = await response.json();
      if (resData.data) {
        return resData.data;
      }
    }
  } catch (error: any) {
    console.error("Erro no Daily Financial Insight via proxy:", error);
  }

  // Safe and Instant algorithmic fallback
  const diffAmount = params.todaySpending - params.monthlyAvgDailySpend;
  const diffPercent = params.monthlyAvgDailySpend > 0
    ? Math.round(((params.todaySpending - params.monthlyAvgDailySpend) / params.monthlyAvgDailySpend) * 100)
    : 0;

  return {
    headline: diffPercent > 0 ? `Gastos ${diffPercent}% acima da média diária` : 'Gastos diários sob controle',
    analysis: `Hoje você gastou R$ ${params.todaySpending.toFixed(2)}, enquanto sua média do mês é de R$ ${params.monthlyAvgDailySpend.toFixed(2)}/dia.`,
    actionableTip: diffPercent > 0 
      ? 'Compense os gastos atípicos de hoje limitando compras variáveis amanhã.' 
      : 'Mantenha esse ritmo para garantir sobra financeira no fechamento do mês.',
    healthStatus: diffPercent > 20 ? 'ATTENTION' : 'GOOD',
    spendingPace: diffPercent > 20 ? 'ABOVE_BENCHMARK' : 'OPTIMAL',
    todaySpending: params.todaySpending,
    monthlyAvgDailySpend: params.monthlyAvgDailySpend,
    diffPercent,
    status: diffPercent > 15 ? 'ABOVE_AVERAGE' : diffPercent < -15 ? 'BELOW_AVERAGE' : 'ON_TRACK',
    source: 'algorithmic_fallback'
  };
};

