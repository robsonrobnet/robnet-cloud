import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { decryptValue } from './lib/crypto';

// Global Fetch Interceptor to attach custom Supabase credentials and third-party keys to all backend API calls
const originalFetch = window.fetch;
window.fetch = function (input, init) {
  try {
    const urlStr = typeof input === 'string' ? input : (input && typeof input === 'object' && 'url' in input ? (input as any).url : '');
    
    // Only intercept relative backend endpoints or matching the current host
    if (urlStr && (urlStr.startsWith('/') || urlStr.includes(window.location.host))) {
      const supabaseUrl = localStorage.getItem('finanai_db_url') || '';
      const supabaseKey = localStorage.getItem('finanai_db_key') || '';
      
      init = init || {};
      const headers = new Headers(init.headers || {});
      
      if (supabaseUrl && supabaseKey) {
        if (!headers.has('x-supabase-url')) {
          headers.set('x-supabase-url', supabaseUrl);
        }
        if (!headers.has('x-supabase-key')) {
          headers.set('x-supabase-key', supabaseKey);
        }
      }

      // Securely attach user's local API keys for AI and Stripe to the backend request headers
      const keysMap = {
        'x-gemini-key': 'gemini_key',
        'x-openai-key': 'openai_key',
        'x-stripe-key': 'stripe_key',
        'x-evolution-key': 'whatsapp_key',
        'x-evolution-url': 'whatsapp_url'
      };

      Object.entries(keysMap).forEach(([headerName, localKey]) => {
        if (!headers.has(headerName)) {
          const encrypted = localStorage.getItem(`secure_${localKey}`);
          if (encrypted) {
            const decrypted = decryptValue(encrypted);
            if (decrypted && decrypted.trim() && !decrypted.includes('...')) {
              headers.set(headerName, decrypted.trim());
            }
          }
        }
      });

      init.headers = headers;
    }
  } catch (err) {
    console.warn("[Fetch Interceptor Warning]:", err);
  }
  return originalFetch.call(this, input, init);
};

const rootElement = document.getElementById('root');

window.addEventListener('error', (event) => {
  if (event.message && (event.message.includes('"undefined" is not valid JSON') || event.message.includes('Unexpected token u in JSON'))) {
    console.warn("[Auto-Fix] Detected localStorage corruption. Clearing session data.");
    localStorage.removeItem('finanai_session_v3');
  }
});

if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);