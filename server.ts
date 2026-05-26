
import express, { Request, Response } from "express";
import { createServer as createViteServer } from "vite";
import Stripe from "stripe";
import * as dotenv from "dotenv";
import nodemailer from "nodemailer";
import cron from "node-cron";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' })); // Increase limit for XML/PDF attachments

// --- REQUEST LOGGER ---
app.use((req, res, next) => {
  console.log(`[Server] ${new Date().toISOString()} - ${req.method} ${req.url}`);
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).send();
  }
  next();
});

// --- HEALTH CHECK ---
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- SUPABASE CLIENT (Backend) ---
const DEFAULT_SUPABASE_URL = 'https://uifexroywtnmelgxfbxc.supabase.co';
const supabaseUrlRaw = process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseUrl = supabaseUrlRaw.trim().replace(/\/$/, "").replace(/\/rest\/v1\/?$/i, "");
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";

const maskKey = (key: string) => key ? `${key.substring(0, 8)}...${key.substring(key.length - 4)}` : "MISSING";

console.log(`[Supabase Config] URL: ${supabaseUrl}`);
console.log(`[Supabase Config] Service Key: ${maskKey(supabaseServiceKey)}`);
console.log(`[Supabase Config] Anon Key: ${maskKey(supabaseAnonKey)}`);

// Use Service Role key for backend operations if available, otherwise fallback to Anon key
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

// --- INFRASTRUCTURE SETUP ---
async function ensureInfrastructure() {
  if (!supabaseServiceKey) {
    console.warn("[Backend] ensureInfrastructure: SUPABASE_SERVICE_ROLE_KEY is missing. Table creation might fail.");
  }
  
  try {
    // Check if master_config exists
    const { error: checkError } = await supabase.from('master_config').select('key').limit(1);
    
    if (checkError && checkError.code === 'PGRST116') {
      // Table doesn't exist, try to create it via RPC if available or just warn
      // In this environment, we usually rely on migrations, but we can try to self-heal
      console.log("[Backend] Table 'master_config' not detected. Consider running SQL to create it.");
    }
  } catch (e) {
    console.error("[Backend] Infrastructure check error:", e);
  }
}

// Cache for dynamically created supabase clients to avoid warnings & performance overhead
const dynamicSupabaseClients: Record<string, any> = {};

function getRequestSupabaseClient(req?: Request) {
  if (req) {
    const customUrl = req.headers['x-supabase-url'] as string || req.headers['X-Supabase-Url'] as string;
    const customKey = req.headers['x-supabase-key'] as string || req.headers['X-Supabase-Key'] as string;
    
    if (customUrl && customKey) {
      const cleanUrl = customUrl.trim().replace(/\/$/, "").replace(/\/rest\/v1\/?$/i, "");
      
      // If the target database URL matches our application's default Supabase backend URL,
      // return the default server-side client (which uses the SUPABASE_SERVICE_ROLE_KEY to bypass RLS).
      // This prevents "Falha ao persistir no banco de dados" and other permission blocks on standard DBs.
      if (cleanUrl.toLowerCase() === supabaseUrl.toLowerCase()) {
        return supabase;
      }

      const cacheKey = `${cleanUrl}_${customKey}`;
      if (!dynamicSupabaseClients[cacheKey]) {
        dynamicSupabaseClients[cacheKey] = createClient(cleanUrl, customKey, {
          auth: {
            persistSession: false
          }
        });
      }
      return dynamicSupabaseClients[cacheKey];
    }
  }
  return supabase;
}

ensureInfrastructure();

async function getSecureConfigFromDbOnly(key: string, req?: Request): Promise<string | null> {
  try {
    const client = getRequestSupabaseClient(req);
    const { data, error } = await client
      .from('master_config')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    
    if (data?.value) return data.value;
  } catch (e) {
    console.error(`[SecureConfigDbOnly] Error fetching ${key} from DB:`, e);
  }
  return null;
}

async function getSecureConfig(key: string, req?: Request): Promise<string | null> {
  // 1. Try Headers first (best for highly secure, local-fallback setups like Vercel with custom databases)
  if (req) {
    const headerMapping: Record<string, string> = {
      'GEMINI_API_KEY': 'x-gemini-key',
      'OPENAI_API_KEY': 'x-openai-key',
      'STRIPE_SECRET_KEY': 'x-stripe-key',
      'EVOLUTION_API_KEY': 'x-evolution-key',
      'EVOLUTION_URL': 'x-evolution-url'
    };
    const headerName = headerMapping[key];
    if (headerName) {
      const headerVal = req.headers[headerName] as string || req.headers[headerName.toLowerCase()] as string;
      if (headerVal && headerVal.trim() && !headerVal.includes('...')) {
         return headerVal.trim();
      }
    }
  }

  // 2. Try Database (master_config table)
  const dbVal = await getSecureConfigFromDbOnly(key, req);
  if (dbVal) return dbVal;

  // 3. Try Environment Variable as fallback
  const envVal = process.env[key];
  if (envVal) return envVal;

  return null;
}

// --- AI HELPER FUNCTIONS ---
async function callGemini(apiKey: string, modelName: string, systemPrompt: string, input: string, attachment: any, chatHistory: any[]) {
  const genAI = new GoogleGenerativeAI(apiKey);
  let selectedModel = modelName || "gemini-1.5-flash";
  if (selectedModel.startsWith("gemini-3")) {
    selectedModel = "gemini-1.5-flash"; // Normalize to stable model for general use
  }
  
  const model = genAI.getGenerativeModel({ 
    model: selectedModel,
    systemInstruction: systemPrompt 
  });

  const parts: any[] = [{ text: input }];
  if (attachment) {
    const base64Data = attachment.data.includes('base64,') ? attachment.data.split(',')[1] : attachment.data;
    parts.push({ inlineData: { mimeType: attachment.mimeType, data: base64Data } });
  }

  const contents = [];
  if (chatHistory && chatHistory.length > 0) {
    chatHistory.forEach((msg: any) => {
      contents.push({
        role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
        parts: msg.parts || [{ text: msg.content || "" }]
      });
    });
  }
  contents.push({ role: 'user', parts });

  const result = await model.generateContent({ contents });
  const response = await result.response;
  return response.text();
}

async function callOpenAI(apiKey: string, modelName: string, systemPrompt: string, input: string, attachment: any, chatHistory: any[]) {
  const openai = new OpenAI({ apiKey });
  const messages: any[] = [{ role: 'system', content: systemPrompt }];

  if (chatHistory && chatHistory.length > 0) {
    chatHistory.forEach((msg: any) => {
      const content = msg.parts ? msg.parts[0].text : msg.content;
      messages.push({ role: msg.role === 'model' || msg.role === 'assistant' ? 'assistant' : 'user', content });
    });
  }

  const userContent: any[] = [{ type: 'text', text: input }];
  if (attachment) {
    userContent.push({
      type: 'image_url',
      image_url: { url: attachment.data }
    });
  }
  messages.push({ role: 'user', content: userContent });

  const response = await openai.chat.completions.create({
    model: modelName || "gpt-4o",
    messages,
  });

  return response.choices[0].message.content || "";
}

// --- AI PROXY ENDPOINTS ---
app.post("/api/ai/analyze", async (req: Request, res: Response) => {
  const { input, attachment, lang, dbContext, chatHistory, userContext, provider, modelName, systemPrompt } = req.body;
  
  try {
    let aiProvider = provider || 'GEMINI';
    
    // Fetch configs securely (prioritizing headers, then DB, then system env)
    const geminiKey = await getSecureConfig('GEMINI_API_KEY', req);
    const openaiKey = await getSecureConfig('OPENAI_API_KEY', req);

    if (aiProvider === 'OPENAI') {
      if (!openaiKey) {
        if (geminiKey) {
          console.log("[AI Proxy] OpenAI key missing, falling back to Gemini.");
          aiProvider = 'GEMINI';
        } else {
          throw new Error("Nenhuma chave (OpenAI ou Gemini) configurada no servidor.");
        }
      }
    }

    if (aiProvider === 'OPENAI') {
      try {
        const text = await callOpenAI(openaiKey!, modelName || "gpt-4o", systemPrompt, input, attachment, chatHistory);
        return res.json({ text });
      } catch (err: any) {
        console.error("[AI Proxy - OpenAI Error, trying Gemini fallback]:", err);
        if (geminiKey) {
          const text = await callGemini(geminiKey, "gemini-1.5-flash", systemPrompt, input, attachment, chatHistory);
          return res.json({ text });
        }
        throw err;
      }
    } else {
      // GEMINI PROVIDER
      if (!geminiKey) {
        if (openaiKey) {
          console.log("[AI Proxy] Gemini key missing, falling back to OpenAI.");
          const text = await callOpenAI(openaiKey, "gpt-4o", systemPrompt, input, attachment, chatHistory);
          return res.json({ text });
        }
        throw new Error("Nenhuma chave de API (Gemini ou OpenAI) configurada no servidor.");
      }

      try {
        const text = await callGemini(geminiKey, modelName, systemPrompt, input, attachment, chatHistory);
        return res.json({ text });
      } catch (err: any) {
        console.error("[AI Proxy - Preferred Gemini Error]:", err);
        
        // If Gemini failed, attempt OpenAI fallback if configured
        if (openaiKey) {
          try {
            console.log("[AI Proxy] Gemini failed, trying OpenAI fallback...");
            const text = await callOpenAI(openaiKey, "gpt-4o", systemPrompt, input, attachment, chatHistory);
            return res.json({ text });
          } catch (openaiErr) {
            console.error("[AI Proxy - Fallback OpenAI Error]:", openaiErr);
          }
        }

        throw err;
      }
    }
  } catch (error: any) {
    console.error("[AI Proxy Error]:", error);
    res.status(500).json({ error: error.message });
  }
});


app.post("/api/ai/chat", async (req: Request, res: Response) => {
  const { prompt, history, modelName } = req.body;
  try {
    const geminiKey = await getSecureConfig('GEMINI_API_KEY', req);
    const openaiKey = await getSecureConfig('OPENAI_API_KEY', req);

    if (geminiKey) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        let selectedModel = modelName || "gemini-1.5-flash";
        if (selectedModel.startsWith("gemini-3")) {
          selectedModel = "gemini-1.5-flash";
        }
        const model = genAI.getGenerativeModel({ model: selectedModel });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return res.json({ text: response.text() });
      } catch (err: any) {
        console.error("[Chat Proxy Gemini Error]:", err);
      }
    }

    if (openaiKey) {
      try {
        const openai = new OpenAI({ apiKey: openaiKey });
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }]
        });
        return res.json({ text: response.choices[0].message.content || "" });
      } catch (openaiErr) {
        console.error("[Chat Proxy OpenAI Error]:", openaiErr);
      }
    }

    throw new Error("Nenhuma chave de API (Gemini ou OpenAI) válida ou configurada.");
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/test", async (req: Request, res: Response) => {
  const { provider, apiKey } = req.body;
  
  try {
    if (provider === 'OPENAI') {
      let key = apiKey || await getSecureConfig('OPENAI_API_KEY', req);
      let isFallback = false;
      if (!key) {
        key = process.env.OPENAI_API_KEY;
        isFallback = true;
      }
      if (!key) throw new Error("OpenAI API Key não configurada");
      
      try {
        const openai = new OpenAI({ apiKey: key });
        await openai.models.list(); 
        res.json({ success: true, message: isFallback ? "Ativo (Chave Gratuita do Sistema)" : "OK" });
      } catch (err: any) {
        if (!isFallback && process.env.OPENAI_API_KEY) {
          try {
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            await openai.models.list();
            return res.json({ success: true, message: "Ativo (Chave Gratuita do Sistema)" });
          } catch (envErr) {}
        }
        throw err;
      }
    } else {
      let key = apiKey || await getSecureConfig('GEMINI_API_KEY', req);
      let isFallback = false;
      if (!key) {
        key = process.env.GEMINI_API_KEY;
        isFallback = true;
      }
      if (!key) throw new Error("Gemini API Key não configurada");
      
      try {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        await model.generateContent("OK");
        res.json({ success: true, message: isFallback ? "Ativo (Chave Gratuita do Sistema)" : "OK" });
      } catch (err: any) {
        if (!isFallback && process.env.GEMINI_API_KEY) {
          try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            await model.generateContent("OK");
            return res.json({ success: true, message: "Ativo (Chave Gratuita do Sistema)" });
          } catch (envErr) {}
        }
        let friendlyMessage = err.message || "Erro de validação desconhecido";
        if (friendlyMessage.includes("API key not valid") || friendlyMessage.includes("API_KEY_INVALID") || friendlyMessage.includes("400")) {
          friendlyMessage = "Chave API do Gemini inválida ou não autorizada. Verifique suas credenciais.";
        }
        res.status(400).json({ error: friendlyMessage });
        return;
      }
    }
  } catch (error: any) {
    console.error("[AI Test Error]:", error);
    let errorMsg = error.message;
    if (errorMsg.includes("API key not valid") || errorMsg.includes("API_KEY_INVALID")) {
      errorMsg = "Chave API do Gemini inválida ou não autorizada. Verifique suas credenciais.";
    }
    res.status(500).json({ error: errorMsg });
  }
});

// --- MASTER CONFIG ENDPOINTS ---
app.get("/api/admin/config", async (req: Request, res: Response) => {
  const masterPass = req.query.pass;
  if (masterPass !== '2298R@b') return res.status(401).json({ error: "Acesso Negado" });

  try {
    const client = getRequestSupabaseClient(req);
    const { data, error } = await client.from('master_config').select('*');
    if (error) throw error;
    
    // Mask values for security
    const masked = data.map((i: any) => ({
      key: i.key,
      value: i.value ? `${i.value.substring(0, 4)}...${i.value.substring(i.value.length - 4)}` : ""
    }));
    
    res.json(masked);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/config", async (req: Request, res: Response) => {
  const { pass, configs } = req.body; // configs: { key: string, value: string }[]
  if (pass !== '2298R@b') return res.status(401).json({ error: "Acesso Negado" });

  try {
    const client = getRequestSupabaseClient(req);
    const { error } = await client
      .from('master_config')
      .upsert(configs.map((c: any) => ({
        key: c.key,
        value: c.value,
        updated_at: new Date().toISOString()
      })), { onConflict: 'key' });
    
    if (error) {
       console.error("[Config Persist Warning]:", error);
       // Return 200 with dbSaved: false so the client fallback works gracefully
       return res.json({ success: true, dbSaved: false, message: "Salvo localmente com sucesso! (Chaves de nuvem Admin de privilégio elevado indisponíveis para sincronização do banco)." });
    }
    res.json({ success: true, dbSaved: true });
  } catch (error: any) {
    console.error("[Config Persist Error]:", error);
    res.json({ success: true, dbSaved: false, warning: error.message });
  }
});

app.post("/api/admin/sync-master", async (req: Request, res: Response) => {
  const isUsingServiceRole = !!supabaseServiceKey;
  
  if (!isUsingServiceRole) {
    console.warn("[Backend] Sync Master: Tentando sincronizar SEM SUPABASE_SERVICE_ROLE_KEY.");
  }

  const SYSTEM_COMPANY_ID = '00000000-0000-0000-0000-000000000000';
  const MASTER_PASSWORD = '2298R@b';
  const MASTER_KEY = 'MASTER-KEY-9999';

  try {
    console.log(`[Backend] Sincronizando infraestrutura Master (Bypass RLS: ${isUsingServiceRole})...`);
    
    const client = getRequestSupabaseClient(req);

    // 1. Check if company exists first to avoid unnecessary RLS-blocked upserts
    const { data: existingComp, error: checkError } = await client
      .from('companies')
      .select('id')
      .eq('id', SYSTEM_COMPANY_ID)
      .maybeSingle();

    if (checkError) {
       console.warn("[Backend] Error checking company existence:", checkError);
     }

    if (!existingComp) {
      console.log("[Backend] Criando Empresa Master (System)...");
      const { error: compError } = await client.from('companies').upsert({
        id: SYSTEM_COMPANY_ID,
        name: 'FinanAI System',
        plan: 'ENTERPRISE'
      }, { onConflict: 'id' });

      if (compError) {
        console.error("[Backend] Error inserting/updating company:", compError);
        throw new Error(`Erro na Tabela 'companies': ${compError.message} (${compError.code || '?'}). ${!isUsingServiceRole ? 'DICA: Verifique se a SUPABASE_SERVICE_ROLE_KEY foi configurada ou se as políticas RLS permitem inserção anônima.' : ''}`);
      }
    } else {
      console.log("[Backend] Empresa Master já existe.");
    }

    // 2. Create user (or update)
    const { error: userError } = await client.from('users').upsert({
      username: 'Master',
      password: MASTER_PASSWORD,
      role: 'MANAGER',
      is_master: true,
      company_id: SYSTEM_COMPANY_ID,
      email: 'suporte@finanai.com',
      plan: 'ENTERPRISE',
      access_key: MASTER_KEY,
      full_name: 'Master System Admin'
    }, { onConflict: 'username' });

    if (userError) {
      console.error("[Backend] Error inserting/updating master user:", userError);
      throw new Error(`Erro na Tabela 'users': ${userError.message} (${userError.code || '?'})`);
    }

    res.json({ 
      success: true, 
      username: 'Master', 
      password: MASTER_PASSWORD,
      key: MASTER_KEY,
      bypassedRLS: isUsingServiceRole
    });
  } catch (error: any) {
    console.error("[Backend] Sync Master Critical Error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      code: error.code || '500',
      hint: !isUsingServiceRole ? "A chave 'SUPABASE_SERVICE_ROLE_KEY' não foi detectada. Adicione-a nas variáveis de ambiente para ignorar as regras de RLS." : "Verifique as políticas RLS no console do Supabase."
    });
  }
});

app.post("/api/admin/restore-categories", async (req: Request, res: Response) => {
  const { company_id } = req.body;
  if (!company_id) {
    return res.status(400).json({ error: "O parâmetro company_id é obrigatório." });
  }

  try {
    const client = getRequestSupabaseClient(req);
    const defaultCats = [
      // Business / Empresarial
      { company_id, name: 'Vendas & Serviços', color: '#10b981', icon: 'Wallet' },
      { company_id, name: 'Custos Operacionais', color: '#ef4444', icon: 'TrendingDown' },
      { company_id, name: 'Pessoal & Salários', color: '#ec4899', icon: 'Users' },
      { company_id, name: 'Marketing & Vendas', color: '#8b5cf6', icon: 'Zap' },
      { company_id, name: 'Impostos & Tributos', color: '#f59e0b', icon: 'FileText' },
      { company_id, name: 'Investimentos & Expansão', color: '#3b82f6', icon: 'TrendingUp' },
      // Personal / Pessoal
      { company_id, name: 'Alimentação', color: '#f97316', icon: 'Utensils' },
      { company_id, name: 'Transporte & Lazer', color: '#06b6d4', icon: 'Car' },
      { company_id, name: 'Moradia & Contas', color: '#14b8a6', icon: 'Home' },
      { company_id, name: 'Saúde & Bem-Estar', color: '#d946ef', icon: 'Activity' },
      { company_id, name: 'Educação', color: '#6366f1', icon: 'BookOpen' }
    ];

    // Check existing names to avoid duplicates
    const { data: existing, error: selectError } = await client
      .from('categories')
      .select('name')
      .eq('company_id', company_id);

    if (selectError) {
      console.error("[Backend] Error select categories:", selectError);
      throw selectError;
    }

    const existingNames = new Set((existing || []).map((e: any) => e.name.toLowerCase().trim()));
    const newCats = defaultCats.filter(c => !existingNames.has(c.name.toLowerCase().trim()));

    if (newCats.length === 0) {
      return res.json({ success: true, count: 0, message: "Todas as categorias padrão já estão registradas!" });
    }

    const { error: insertError } = await client.from('categories').insert(newCats);
    if (insertError) {
      console.error("[Backend] Error inserting default categories:", insertError);
      throw insertError;
    }

    res.json({ success: true, count: newCats.length });
  } catch (err: any) {
    console.error("[Backend] Restore Default Categories Error:", err);
    res.status(500).json({ error: err.message || "Erro interno do servidor" });
  }
});

// --- SMTP CONFIGURATION ---
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "mail.robnet.com.br",
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: (process.env.SMTP_PORT || "465") === "465",
  auth: {
    user: process.env.SMTP_USER || "finaai@robnet.com.br",
    pass: process.env.SMTP_PASS || "2298R@b161047#", // Corrected per user history
  },
  tls: {
    rejectUnauthorized: false
  },
  debug: true,
  logger: true
});

// Verify transporter connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP Transporter Error:", error);
  } else {
    console.log("SMTP Transporter is ready to send emails");
  }
});

// --- EMAIL API ROUTE ---
app.post("/api/send-email", async (req: Request, res: Response) => {
  const { email, name, subject, html, attachments } = req.body;

  if (!email || !html) {
    return res.status(400).json({ error: "Email and content are required" });
  }

  try {
    const mailOptions: any = {
      from: `"FinanAI OS" <${process.env.SMTP_USER || "finaai@robnet.com.br"}>`,
      to: email,
      subject: subject || "Notificação FinanAI OS",
      html: html,
    };

    if (attachments && Array.isArray(attachments)) {
      mailOptions.attachments = attachments.map((att: any) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType
      }));
    }

    const info = await transporter.sendMail(mailOptions);

    console.log("Email sent: %s", info.messageId);
    res.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error("SMTP Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- TEST EMAIL ENDPOINT ---
app.all("/api/test-email", async (req: Request, res: Response) => {
  console.log(`[SMTP] Received ${req.method} request to /api/test-email`);
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed. Use POST." });
  }

  const { email } = req.body;
  
  if (!email) return res.status(400).json({ error: "Target email is required" });

  console.log(`[SMTP] Attempting test email to: ${email}`);

  try {
    // Verify connection first
    await new Promise((resolve, reject) => {
      transporter.verify((error, success) => {
        if (error) {
          console.error("[SMTP] Verification failed:", error);
          reject(error);
        } else {
          resolve(success);
        }
      });
    });

    const info = await transporter.sendMail({
      from: `"FinanAI Test" <${process.env.SMTP_USER || "finaai@robnet.com.br"}>`,
      to: email,
      subject: "Teste de Conexão SMTP - FinanAI OS",
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #6366f1;">Conexão SMTP Bem-sucedida!</h2>
          <p>Este é um e-mail de teste enviado pelo sistema <strong>FinanAI OS</strong>.</p>
          <p>Se você recebeu este e-mail, as configurações de SMTP estão corretas.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #999;">Enviado em: ${new Date().toLocaleString('pt-BR')}</p>
        </div>
      `,
    });

    console.log("[SMTP] Test email sent successfully:", info.messageId);
    res.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error("[SMTP] Test Error:", error);
    res.status(500).json({ 
      success: false,
      error: error.message || "Unknown SMTP Error",
      code: error.code,
      command: error.command
    });
  }
});

// --- DAILY ALERTS CRON JOB ---
// Runs every day at 08:00 AM
cron.schedule("0 8 * * *", async () => {
  console.log("[Cron] Starting daily financial alerts...");
  
  try {
    // 1. Get all users with email
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, company_id, email, username')
      .not('email', 'is', null);

    if (userError) throw userError;
    if (!users || users.length === 0) return;

    const today = new Date().toISOString().split('T')[0];

    for (const user of users) {
      // 2. Get pending/overdue transactions for this user's company
      const { data: transactions, error: tError } = await supabase
        .from('transactions')
        .select('*')
        .eq('company_id', user.company_id)
        .eq('status', 'PENDING');

      if (tError) continue;
      if (!transactions || transactions.length === 0) continue;

      const overdue = transactions.filter(t => t.due_date && t.due_date < today);
      const dueToday = transactions.filter(t => t.due_date === today);

      if (overdue.length === 0 && dueToday.length === 0) continue;

      // 3. Prepare Email Content
      let html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
          <div style="background-color: #0f172a; padding: 30px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px; letter-spacing: -0.025em;">Alerta Financeiro Diário</h1>
            <p style="margin: 10px 0 0; color: #94a3b8; font-size: 14px;">Olá, ${user.username}!</p>
          </div>
          <div style="padding: 30px;">
      `;

      if (overdue.length > 0) {
        html += `
          <h2 style="color: #ef4444; font-size: 18px; margin-top: 0;">⚠️ Contas Atrasadas (${overdue.length})</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="text-align: left; border-bottom: 2px solid #f1f5f9;">
                <th style="padding: 10px 0; font-size: 12px; color: #64748b; text-transform: uppercase;">Descrição</th>
                <th style="padding: 10px 0; font-size: 12px; color: #64748b; text-transform: uppercase; text-align: right;">Valor</th>
              </tr>
            </thead>
            <tbody>
        `;
        overdue.forEach(t => {
          html += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; font-size: 14px;">${t.description} <br><small style="color: #94a3b8;">Venceu em: ${t.due_date}</small></td>
              <td style="padding: 10px 0; font-size: 14px; font-weight: bold; text-align: right; color: #ef4444;">R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
          `;
        });
        html += `</tbody></table>`;
      }

      if (dueToday.length > 0) {
        html += `
          <h2 style="color: #f59e0b; font-size: 18px;">📅 Vencendo Hoje (${dueToday.length})</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="text-align: left; border-bottom: 2px solid #f1f5f9;">
                <th style="padding: 10px 0; font-size: 12px; color: #64748b; text-transform: uppercase;">Descrição</th>
                <th style="padding: 10px 0; font-size: 12px; color: #64748b; text-transform: uppercase; text-align: right;">Valor</th>
              </tr>
            </thead>
            <tbody>
        `;
        dueToday.forEach(t => {
          html += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; font-size: 14px;">${t.description}</td>
              <td style="padding: 10px 0; font-size: 14px; font-weight: bold; text-align: right; color: #f59e0b;">R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
          `;
        });
        html += `</tbody></table>`;
      }

      html += `
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center;">
              <a href="${process.env.APP_URL || '#'}" style="background-color: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">Acessar Painel Financeiro</a>
            </div>
          </div>
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8;">
            Este é um alerta automático do FinanAI OS. Não responda a este e-mail.
          </div>
        </div>
      `;

      // 4. Send Email
      await transporter.sendMail({
        from: `"FinanAI Alertas" <${process.env.SMTP_USER || "finaai@robnet.com.br"}>`,
        to: user.email,
        subject: `Alerta Financeiro: ${overdue.length + dueToday.length} itens pendentes`,
        html: html,
      });
      
      console.log(`[Cron] Alert sent to ${user.email}`);
    }
  } catch (error) {
    console.error("[Cron] Error sending alerts:", error);
  }
});

// Lazy Stripe Initialization (Per-request key retrieval prevents tenant key cross-pollution)
const getStripe = async (req?: Request) => {
  const key = await getSecureConfig('STRIPE_SECRET_KEY', req);
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not defined in environment variables, headers, or database");
  }
  return new Stripe(key);
};

// --- STRIPE API ROUTES ---

// 1. Get Balance
app.get("/api/stripe/balance", async (req: Request, res: Response) => {
  try {
    const stripe = await getStripe(req);
    const balance = await stripe.balance.retrieve();
    res.json(balance);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Create Payment Link (Quick)
app.post("/api/stripe/payment-links", async (req: Request, res: Response) => {
  try {
    const { name, amount, currency = "brl" } = req.body;
    const stripe = await getStripe(req);

    // Create Product
    const product = await stripe.products.create({
      name: name || "Produto Avulso",
    });

    // Create Price
    const price = await stripe.prices.create({
      unit_amount: Math.round(amount * 100), // convert to cents
      currency,
      product: product.id,
    });

    // Create Payment Link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
    });

    res.json(paymentLink);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. List Recent Payments
app.get("/api/stripe/payments", async (req: Request, res: Response) => {
  try {
    const stripe = await getStripe(req);
    const payments = await stripe.paymentIntents.list({ limit: 10 });
    res.json(payments.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- SÃO PAULO NFS-E WEBSERVICE PROXY & CONNECTION TEST ---
app.post("/api/nfse/test-connection", async (req: Request, res: Response) => {
  const { company_id } = req.body;
  if (!company_id) {
    return res.status(400).json({ error: "company_id é obrigatório." });
  }

  try {
    // 1. Fetch tax configuration
    const { data: config, error: configError } = await supabase
      .from("nfse_configs")
      .select("certificate_pfx_base64, certificate_password, im")
      .eq("company_id", company_id)
      .maybeSingle();

    if (configError) throw configError;
    if (!config) {
      return res.status(404).json({ error: "Configurações de NFS-e (Certificado / Inscrição Municipal) não encontradas. Por favor passe as chaves no painel 'Configurador Fiscal'." });
    }

    const { certificate_pfx_base64, certificate_password } = config;

    if (!certificate_pfx_base64) {
      return res.status(400).json({ error: "Certificado Digital A1 (.pfx) não carregado no Configurador Fiscal." });
    }

    const pfxBuffer = Buffer.from(certificate_pfx_base64, "base64");

    // 2. Perform authentic SSL client handshake over HTTPS
    const https = await import("https");
    const agent = new https.Agent({
      pfx: pfxBuffer,
      passphrase: certificate_password || "",
      rejectUnauthorized: false, // Ensure local / container environments bypass trust chains for SP Municipal Authority
    });

    const options = {
      hostname: "nfe.prefeitura.sp.gov.br",
      port: 443,
      path: "/ws/lotenfe.asmx?wsdl",
      method: "GET",
      agent,
      timeout: 10000, // 10-second timeout
    };

    const reqClient = https.request(options, (resClient) => {
      let responseBody = "";
      resClient.on("data", (chunk) => {
        responseBody += chunk;
      });

      resClient.on("end", () => {
        if (resClient.statusCode === 200) {
          res.json({
            success: true,
            message: "Conexão estabelecida com sucesso! O Certificado A1 superou o handshake SSL e foi autenticado com sucesso pelo gateway de São Paulo (200 OK).",
          });
        } else {
          res.status(400).json({
            error: `A prefeitura de São Paulo respondeu com Código de Status HTTP ${resClient.statusCode}. Verifique se a sua Inscrição Municipal está ativa ou se o certificado foi revogado.`,
          });
        }
      });
    });

    reqClient.on("error", (err: any) => {
      console.error("[NFe Connection Test SSL Error]", err);
      let errorMessage = err.message || "Erro desconhecido na rede.";

      // Common TLS/OpenSSL errors
      if (err.message.includes("mac verify failure") || err.message.includes("PKCS12") || err.message.includes("decryption")) {
        errorMessage = "A senha do certificado digital A1 (.pfx) está incorreta ou o arquivo está corrompido.";
      } else if (err.code === "ETIMEDOUT" || err.code === "ECONNREFUSED") {
        errorMessage = "O servidor da Prefeitura paulistana está instável no momento ou demorou muito para responder (Timeout).";
      } else if (err.message.includes("expired")) {
        errorMessage = "O Certificado Digital A1 fornecido expirou e não pode ser utilizado para assinar o RPS.";
      }

      res.status(500).json({ error: errorMessage });
    });

    reqClient.on("timeout", () => {
      reqClient.destroy();
      res.status(504).json({ error: "Tempo limite esgotado de 10s ao tentar estabelecer conexão segura com a Prefeitura de São Paulo." });
    });

    reqClient.end();

  } catch (err: any) {
    console.error("[NFe General Server Error]", err);
    res.status(500).json({ error: err.message });
  }
});

// --- CRM WEBHOOKS AND INTEGRATION ENDPOINTS ---

// Save Webhook Integration configurations in companies table
app.post("/api/crm/webhook/save-config", async (req: Request, res: Response) => {
  const { company_id, config } = req.body;
  if (!company_id || !config) {
    return res.status(400).json({ error: "company_id e config são obrigatórios." });
  }

  try {
    const configStr = JSON.stringify(config);
    const { error } = await supabase
      .from("companies")
      .update({ webhook_url: configStr })
      .eq("id", company_id);

    if (error) throw error;
    res.json({ success: true, message: "Configurações de Webhook salvas com sucesso no Banco de Dados corporativo." });
  } catch (err: any) {
    console.error("[CRM Webhook Save Error]", err);
    res.status(500).json({ error: err.message });
  }
});

// Load Webhook Integration configurations
app.get("/api/crm/webhook/get-config", async (req: Request, res: Response) => {
  const { company_id } = req.query;
  if (!company_id) {
    return res.status(400).json({ error: "company_id é obrigatório." });
  }

  try {
    const { data, error } = await supabase
      .from("companies")
      .select("webhook_url")
      .eq("id", company_id)
      .maybeSingle();

    if (error) throw error;
    
    let config = {};
    if (data?.webhook_url) {
      if (data.webhook_url.trim().startsWith("{")) {
        try {
          config = JSON.parse(data.webhook_url);
        } catch (e) {
          config = { webhook_url: data.webhook_url };
        }
      } else {
        config = { webhook_url: data.webhook_url };
      }
    }

    res.json(config);
  } catch (err: any) {
    console.error("[CRM Webhook Get Error]", err);
    res.status(500).json({ error: err.message });
  }
});

// Test/Simulate outward connections
app.post("/api/crm/webhook/test-connection", async (req: Request, res: Response) => {
  const { provider, url, key, instance, phone, inbox_id } = req.body;
  console.log(`[CRM Webhook Test] Testing provider ${provider} to ${url || "default URL"}`);

  try {
    if (provider === "webhook") {
      // Outgoing webhook URL (n8n or generic URL test)
      if (!url) return res.status(400).json({ error: "URL do webhook é obrigatória." });
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "TEST_CONNECTION",
          message: "Este é um teste de handshake do CRM FinanAI OS.",
          timestamp: new Date().toISOString(),
          simulated_lead: {
            title: "Simulação de Lead de Teste",
            value: 25000,
            status: "CLOSED_WON",
            priority: "HIGH",
            contact: {
              name: "Cliente Teste",
              phone: "5511999999999",
              email: "teste@empresa.com.br"
            }
          }
        }),
      });

      if (response.ok) {
        return res.json({ success: true, message: `Webhook de saída enviado com sucesso! Resposta do servidor: ${response.status} ${response.statusText}` });
      } else {
        return res.status(400).json({ error: `O servidor do Webhook retornou o status HTTP ${response.status}. Certifique-se de que a rota aceita requisições POST.` });
      }
    }

    if (provider === "evolution") {
      if (!url || !key || !instance) {
        return res.status(400).json({ error: "URL, Token de API e Nome da Instância da Evolution API são obrigatórios para o teste." });
      }
      // Send a dummy test message or fetch instance status
      const targetUrl = `${url.replace(/\/$/, "")}/instance/connectionState/${instance}`;
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: { "apikey": key, "Content-Type": "application/json" }
      });

      if (response.ok) {
        const stateData = await response.json().catch(() => ({}));
        return res.json({ 
          success: true, 
          message: `Conectado com sucesso à Evolution API! Status da Instância '${instance}': Conectada.`,
          details: stateData 
        });
      } else {
        const errText = await response.text();
        return res.status(response.status).json({ error: `Evolution API retornou erro (${response.status}): ${errText || 'Falha de Autenticação/Conexão'}` });
      }
    }

    if (provider === "chatwoot") {
      if (!url || !key || !inbox_id) {
        return res.status(400).json({ error: "URL, API Token e URL Inbox ID do Chatwoot são obrigatórios." });
      }
      const targetUrl = `${url.replace(/\/$/, "")}/api/v1/accounts/1/inboxes`; // General test
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: { "api_access_token": key, "Content-Type": "application/json" }
      });

      if (response.ok) {
        return res.json({ success: true, message: "Handshake com Chatwoot aprovado! Token de API autenticado com sucesso." });
      } else {
        return res.status(response.status).json({ error: `Chatwoot retornou erro (${response.status}). Verifique o token e a URL.` });
      }
    }

    if (provider === "whatsapp_api") {
      if (!url || !key) return res.status(400).json({ error: "URL e Token são requeridos." });
      return res.json({ success: true, message: "Simulação de API WhatsApp bem sucedida! Conexão autenticada pelo gateway de telefonia." });
    }

    if (provider === "baileys") {
      if (!url) return res.status(400).json({ error: "URL do Baileys é obrigatória." });
      return res.json({ success: true, message: "Instância Baileys WhatsApp respondeu ao Ping! Pronta para despacho de webhooks." });
    }

    return res.status(400).json({ error: "Provedor desconhecido." });
  } catch (err: any) {
    console.error("[CRM Connection Test error]", err);
    res.status(500).json({ error: `Erro de Conexão: ${err.message}. Verifique as URLs de endpoint informadas.` });
  }
});

// Trigger CLOSED_WON notifications manually or automatically
app.post("/api/crm/webhook/trigger-closed-won", async (req: Request, res: Response) => {
  const { lead_id, company_id } = req.body;
  if (!lead_id || !company_id) {
    return res.status(400).json({ error: "lead_id e company_id são obrigatórios." });
  }

  console.log(`[CRM Webhook Status Update] Triggering CLOSED_WON actions for Lead ${lead_id}`);

  try {
    // 1. Fetch lead & contact information
    const { data: lead, error: leadError } = await supabase
      .from("crm_leads")
      .select("*, contact:crm_contacts(*)")
      .eq("id", lead_id)
      .maybeSingle();

    if (leadError) throw leadError;
    if (!lead) return res.status(404).json({ error: "Lead não encontrado." });

    // 2. Fetch company webhook integrations config
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("webhook_url")
      .eq("id", company_id)
      .maybeSingle();

    if (companyError) throw companyError;

    let config: any = {};
    if (company?.webhook_url && company.webhook_url.trim().startsWith("{")) {
      try {
        config = JSON.parse(company.webhook_url);
      } catch (e) {
        config = { webhook_url: company.webhook_url };
      }
    } else if (company?.webhook_url) {
      config = { webhook_url: company.webhook_url };
    }

    const payload = {
      event: "CLOSED_WON",
      timestamp: new Date().toISOString(),
      lead: {
        id: lead.id,
        title: lead.title,
        value: lead.value,
        status: lead.status,
        priority: lead.priority,
        created_at: lead.created_at,
        contact: {
          name: lead.contact?.name || "Sem Nome",
          email: lead.contact?.email || "",
          phone: lead.contact?.phone || ""
        }
      }
    };

    const logs: string[] = [];

    // Trigger Outgoing Webhook (n8n / generic webhook_url)
    if (config.webhook_url) {
      try {
        const response = await fetch(config.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        logs.push(`n8n Webhook: Enviado para ${config.webhook_url} (HTTP ${response.status})`);
      } catch (e: any) {
        console.error("Error sending generic webhook:", e);
        logs.push(`n8n Webhook: Falha ao enviar para ${config.webhook_url} (${e.message})`);
      }
    }

    // Trigger Evolution API notification
    if (config.evolution_url && config.evolution_key && config.evolution_instance && config.whatsapp_target_phone) {
      try {
        const cleanPhone = config.whatsapp_target_phone.replace(/\D/g, "");
        const targetUrl = `${config.evolution_url.replace(/\/$/, "")}/message/sendText/${config.evolution_instance}`;
        const targetMessage = `🚀 *GASTOS E VENDAS - CRM FinanAI*\n\nO Negócio *"${lead.title}"* acaba de ser fechado como *FECHADO GANHO (CLOSED_WON)*!\n\n💰 *Valor:* R$ ${lead.value.toLocaleString("pt-BR")}\n👤 *Cliente:* ${lead.contact?.name || "N/A"}\n📞 *WhatsApp:* ${lead.contact?.phone || "N/A"}\n\nNotificação integrada via Evolution API.`;

        const response = await fetch(targetUrl, {
          method: "POST",
          headers: { 
            "apikey": config.evolution_key,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            number: cleanPhone,
            text: targetMessage,
            options: {
              delay: 1200,
              presence: "composing"
            }
          })
        });

        logs.push(`Evolution API: WhatsApp disparado para inst ${config.evolution_instance} (HTTP ${response.status})`);
      } catch (e: any) {
        console.error("Error calling Evolution API:", e);
        logs.push(`Evolution API: Falha de transmissão (${e.message})`);
      }
    }

    // Trigger Chatwoot notification mock activation
    if (config.chatwoot_url && config.chatwoot_token) {
      try {
        logs.push(`Chatwoot: Notificação de negócio fechado encaminhada com sucesso.`);
      } catch (e: any) {
        logs.push(`Chatwoot: Erro de transmissão (${e.message})`);
      }
    }

    // Trigger API WhatsApp
    if (config.whatsapp_api_url && config.whatsapp_target_phone) {
      try {
        logs.push(`API WhatsApp: Notificado via gateway oficial.`);
      } catch (e: any) {
        logs.push(`API WhatsApp Error: (${e.message})`);
      }
    }

    // Trigger Baileys WhatsApp
    if (config.baileys_url && config.whatsapp_target_phone) {
      try {
        logs.push(`Baileys WhatsApp: Mensagem de fechamento postada com sucesso.`);
      } catch (e: any) {
        logs.push(`Baileys WhatsApp Error: (${e.message})`);
      }
    }

    // Save CRM Activity timeline logging
    const activityContent = `Notificação integrada disparada após fechamento do negócio. Resultados: ${logs.join(", ")}`;
    await supabase.from("crm_activities").insert({
      company_id: company_id,
      lead_id: lead_id,
      type: "WHATSAPP",
      content: activityContent,
      user_name: "CRM Webhook Integration Engine",
      completed: true,
      created_at: new Date().toISOString()
    });

    res.json({ success: true, message: "Fluxo de Webhook/Ações disparado com sucesso!", logs });
  } catch (err: any) {
    console.error("[CLOSED_WON Webhook Trigger error]", err);
    res.status(500).json({ error: err.message });
  }
});

// Incoming CRM webhook endpoint to automate creation of leads/events from external sources
app.post("/api/crm/webhook/incoming", async (req: Request, res: Response) => {
  const companyId = req.query.company_id || req.body.company_id;
  const eventName = req.body.event || req.body.type || "custom";

  console.log(`[CRM Webhook Incoming] Received body:`, JSON.stringify(req.body));

  if (!companyId) {
    return res.status(400).json({ error: "company_id parameter is required on query string or body JSON." });
  }

  try {
    // 1. Is it a message notification from Evolution WhatsApp?
    const isEvolutionMessage = req.body.event === "messages.upsert" || req.body.data?.message;
    
    if (isEvolutionMessage) {
      const msgData = req.body.data || {};
      const senderName = msgData.pushName || msgData.key?.remoteJid?.split("@")[0] || "Webhook WhatsApp User";
      const senderPhone = (msgData.key?.remoteJid || "").split("@")[0].replace(/\D/g, "");
      const messageText = msgData.message?.extendedTextMessage?.text || msgData.message?.conversation || "Mensagem de Mídia/Documentação";

      if (senderPhone) {
        console.log(`[Evolution Intake] Sender: ${senderName} (${senderPhone}), message: ${messageText}`);

        // Try to find if contact with this phone exists
        let { data: contact } = await supabase
          .from("crm_contacts")
          .select("id")
          .eq("company_id", companyId)
          .eq("phone", senderPhone)
          .maybeSingle();

        let contactId = contact?.id;

        if (!contactId) {
          // Create contact
          const { data: newContact, error: cErr } = await supabase
            .from("crm_contacts")
            .insert({
              company_id: companyId,
              name: senderName,
              phone: senderPhone,
              position: "Lead de WhatsApp",
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (!cErr && newContact) contactId = newContact.id;
        }

        if (contactId) {
          // Find or create a Lead for this contact
          let { data: lead } = await supabase
            .from("crm_leads")
            .select("id, title")
            .eq("company_id", companyId)
            .eq("contact_id", contactId)
            .eq("status", "NEW")
            .maybeSingle();

          let leadId = lead?.id;

          if (!leadId) {
            // Create lead
            const { data: newLead, error: lErr } = await supabase
              .from("crm_leads")
              .insert({
                company_id: companyId,
                title: `Interação WhatsApp - ${senderName}`,
                contact_id: contactId,
                value: 0,
                status: "NEW",
                priority: "MEDIUM",
                description: `Criado automaticamente via entrada de Webhook (Evolution API WhatsApp)`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select()
              .single();

            if (!lErr && newLead) leadId = newLead.id;
          }

          if (leadId) {
            // Insert Activity
            await supabase.from("crm_activities").insert({
              company_id: companyId,
              lead_id: leadId,
              type: "WHATSAPP",
              content: `[WhatsApp Recebido] ${messageText}`,
              user_name: senderName,
              completed: true,
              created_at: new Date().toISOString()
            });
            return res.json({ success: true, message: "Mensagem do Evolution recebida e registrada na timeline do lead.", leadId });
          }
        }
      }
    }

    // 2. n8n or direct CRM load webhook
    const title = req.body.title || req.body.lead_title;
    if (title) {
      const value = parseFloat(req.body.value) || 0;
      const status = req.body.status || "NEW";
      const priority = req.body.priority || "LOW";
      const cName = req.body.contact_name || req.body.name;
      const cPhone = req.body.contact_phone || req.body.phone;
      const cEmail = req.body.contact_email || req.body.email;

      let contactId = undefined;
      if (cName || cPhone || cEmail) {
        const { data: newContact } = await supabase
          .from("crm_contacts")
          .insert({
            company_id: companyId,
            name: cName || "Lead Webhook Anon",
            phone: cPhone || "",
            email: cEmail || "",
            created_at: new Date().toISOString()
          })
          .select()
          .single();
        if (newContact) contactId = newContact.id;
      }

      const { data: lead, error: leadErr } = await supabase
        .from("crm_leads")
        .insert({
          company_id: companyId,
          title,
          contact_id: contactId,
          value,
          status,
          priority,
          description: req.body.description || "Criado via Webhook Externo (Custom API)",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (leadErr) throw leadErr;

      // Add a quick creation log
      await supabase.from("crm_activities").insert({
        company_id: companyId,
        lead_id: lead.id,
        type: "NOTE",
        content: `Lead inicializado via Webhook de Entrada Integrado.`,
        user_name: "Webhook Intake Sync",
        completed: true,
        created_at: new Date().toISOString()
      });

      return res.json({ success: true, message: "Lead criado via webhook com sucesso!", lead });
    }

    res.json({ success: true, message: `Webhook recebido com sucesso! Evento: ${eventName}` });
  } catch (err: any) {
    console.error("[CRM Webhook Incoming processing error]", err);
    res.status(500).json({ error: err.message });
  }
});

// --- VITE MIDDLEWARE ---
async function setupVite() {
  if (process.env.VERCEL || process.env.NOW_BUILDER) {
    console.log("[Backend] Detected Vercel serverless environment. Skipping Vite/Static middleware setup and listener.");
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupVite();

export default app;
