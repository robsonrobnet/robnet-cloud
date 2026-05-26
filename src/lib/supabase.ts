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
 * Prevents [object Object] by extracting message, details, and hints.
 */
export const formatSupabaseError = (e: any): string => {
  if (e === null || e === undefined) return "Erro desconhecido.";
  if (typeof e === 'string') return e;
  
  // Handle Supabase Postgrest Error structure
  if (e.message || e.code || e.details || e.hint) {
    let msg = e.message || "Erro de Banco de Dados";
    if (e.code) msg = `[${e.code}] ${msg}`;
    if (e.details && e.details !== 'null') msg += ` | Detalhes: ${e.details}`;
    if (e.hint && e.hint !== 'null') msg += ` | Dica: ${e.hint}`;
    return msg;
  }

  // Handle standard JS Error
  if (e instanceof Error) {
    const msg = e.message;
    if (msg === 'Failed to fetch') {
      return "Erro de Conexão: Não foi possível alcançar o banco de dados. Verifique sua URL do Supabase ou se o projeto está ativo.";
    }
    if (msg.includes('Invalid path specified in request URL')) {
      return "URL do Supabase inválida: Certifique-se de que a URL não possui barras extras ou está configurada corretamente no Admin Settings.";
    }
    return msg;
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
      return "Ocorreu um erro inesperado (detalhes indisponíveis).";
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
