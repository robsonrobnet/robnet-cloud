import { createClient } from '@supabase/supabase-js';

// Fallback credentials if localStorage is empty
const DEFAULT_URL = 'https://uifexroywtnmelgxfbxc.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpZmV4cm95d3RubWVsZ3hmYnhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTM4MzQsImV4cCI6MjA4MzQ4OTgzNH0.y9RCTh84rzj7chgvj-wDqZLIafl43djujOpw5GD6PUI';

let supabaseUrl = localStorage.getItem('finanai_db_url') || DEFAULT_URL;
let supabaseAnonKey = localStorage.getItem('finanai_db_key') || DEFAULT_KEY;

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
  if (e instanceof Error) return e.message;

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

// Initialize client with safety check
export let supabase = createClient(supabaseUrl, supabaseAnonKey || DEFAULT_KEY);

export const updateSupabaseConfig = (url: string, key: string) => {
  const safeUrl = url || DEFAULT_URL;
  const safeKey = key || DEFAULT_KEY;
  
  localStorage.setItem('finanai_db_url', safeUrl);
  localStorage.setItem('finanai_db_key', safeKey);
  
  supabase = createClient(safeUrl, safeKey);
};