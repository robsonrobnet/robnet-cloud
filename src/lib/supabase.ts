import { createClient } from '@supabase/supabase-js';

// Fallback credentials if environment and localStorage are empty
const DEFAULT_URL = 'https://uifexroywtnmelgxfbxc.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpZmV4cm95d3RubWVsZ3hmYnhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTM4MzQsImV4cCI6MjA4MzQ4OTgzNH0.y9RCTh84rzj7chgvj-wDqZLIafl43djujOpw5GD6PUI';

const cleanSupabaseUrl = (url: string): string => {
  if (!url) return '';
  return url.trim().replace(/\/$/, "").replace(/\/rest\/v1\/?$/i, "");
};

const supabaseUrl = cleanSupabaseUrl(localStorage.getItem('finanai_db_url') || import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL);
const supabaseAnonKey = (localStorage.getItem('finanai_db_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_KEY).trim();

/**
 * Robust error formatter for Supabase/Postgrest errors.
 * Prevents [object Object] and formats Failed to fetch connection errors cleanly.
 */
export const formatSupabaseError = (e: any): string => {
  if (e === null || e === undefined) return "Erro desconhecido.";

  // Extract combined string representation to catch network or connection failures
  const combinedText = typeof e === 'string'
    ? e
    : [e?.message, e?.details, e?.hint, e?.error, String(e)].filter(Boolean).join(' ');

  if (combinedText.includes('Failed to fetch') || combinedText.includes('NetworkError') || combinedText.includes('NETWORK_ERROR')) {
    return "Erro de Conexão com o Banco de Dados (Failed to fetch): Não foi possível conectar ao Supabase. Verifique se o projeto Supabase está ativo, se a URL e Chave nas Configurações estão corretas e se há conexão com a internet.";
  }

  if (combinedText.includes('Invalid path specified in request URL')) {
    return "URL do Supabase inválida: Certifique-se de que a URL não possui caminhos ou barras extras e está configurada corretamente no painel Admin.";
  }

  if (typeof e === 'string') return e;

  // Handle Supabase Postgrest Error structure
  if (e.message || e.code || e.details || e.hint) {
    let msg = e.message || "Erro de Banco de Dados";
    if (e.code) msg = `[${e.code}] ${msg}`;
    if (e.details && e.details !== 'null' && e.details !== e.message && !e.details.includes(e.message)) {
      msg += ` | Detalhes: ${e.details}`;
    }
    if (e.hint && e.hint !== 'null') msg += ` | Dica: ${e.hint}`;
    return msg;
  }

  // Handle standard JS Error
  if (e instanceof Error) {
    return e.message;
  }

  // Handle common API error patterns
  if (e.error && typeof e.error === 'string') return e.error;

  // Fallback to stringification
  try {
    const stringified = JSON.stringify(e, null, 2);
    if (stringified && stringified !== '{}' && stringified !== '[]') {
       return stringified;
    }
  } catch {
    // ignore json error
  }
  
  // Last resort to avoid [object Object]
  const raw = String(e);
  if (raw === '[object Object]') {
      return "Ocorreu um erro inesperado no banco de dados.";
  }
  return raw;
};

// Cache client instances in window to prevent HMR and multiple GoTrue client warnings
const getCachedClient = (url: string, key: string) => {
  const win = window as any;
  const cacheKey = `${url}_${key}`;
  if (!win.__supabaseClients) {
    win.__supabaseClients = {};
  }
  if (!win.__supabaseClients[cacheKey]) {
    win.__supabaseClients[cacheKey] = createClient(url, key, {
      auth: {
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true
      }
    });
  }
  win.__currentSupabaseClient = win.__supabaseClients[cacheKey];
  return win.__currentSupabaseClient;
};

// Initialize client with safety check and cache
export let supabase = getCachedClient(supabaseUrl, supabaseAnonKey || DEFAULT_KEY);

export const updateSupabaseConfig = (url: string, key: string) => {
  const safeUrl = cleanSupabaseUrl(url || DEFAULT_URL);
  const safeKey = (key || DEFAULT_KEY).trim();
  
  localStorage.setItem('finanai_db_url', safeUrl);
  localStorage.setItem('finanai_db_key', safeKey);
  
  supabase = getCachedClient(safeUrl, safeKey);
};
