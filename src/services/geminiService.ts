
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
  try {
    const provider = localStorage.getItem('chat_provider') || 'GEMINI';
    const agora = new Date();
    const dateContext = `[Data/Hora Atual]: ${agora.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    
    // We send extra context as system instruction components
    let fullSystemPrompt = SYSTEM_PROMPT;
    fullSystemPrompt += `\n${dateContext}`;
    if (userContext) fullSystemPrompt += `\n[Contexto do Usuário]: Nome: ${userContext.name}, Plano: ${userContext.plan}`;
    if (dbContext) fullSystemPrompt += `\n[Contexto DB]: ${dbContext}`;

    const response = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input,
        attachment,
        lang,
        chatHistory,
        provider,
        modelName: provider === 'OPENAI' ? (localStorage.getItem('openai_model') || 'gpt-4o') : (localStorage.getItem('gemini_model') || 'gemini-3.6-flash'),
        systemPrompt: fullSystemPrompt
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Erro no proxy do servidor");
    }

    const data = await response.json();
    return processAIResponse(data.text);
  } catch (error: any) {
    console.error("AI Analysis Error:", error);
    return { textResponse: `⚠️ Falha na análise inteligente: ${error.message}` };
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
  try {
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, history })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Erro no servidor");
    }

    const data = await response.json();
    return data.text.trim();
  } catch (error: any) {
    console.error("Gemini Generic Error:", error);
    return `Erro ao gerar resposta: ${error.message}`;
  }
};

/**
 * Testa a conexão com o Gemini API via Backend Proxy.
 */
export const testGeminiConnection = async (apiKey?: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: 'GEMINI', apiKey })
    });
    
    if (!response.ok) {
        const err = await response.json();
        return { success: false, message: err.error || "Erro no servidor" };
    }
    
    const data = await response.json();
    return { success: true, message: data.message || "OK" };
  } catch (error: any) {
    console.error("Gemini Test Error:", error);
    return { success: false, message: error.message || "Erro desconhecido na conexão" };
  }
};
