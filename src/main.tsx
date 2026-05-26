import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Global Fetch Interceptor to attach custom Supabase credentials to all backend API calls
const originalFetch = window.fetch;
window.fetch = function (input, init) {
  const urlStr = typeof input === 'string' ? input : (input && 'url' in input ? (input as any).url : '');
  
  // Only intercept relative backend endpoints or matching the current host
  if (urlStr.startsWith('/') || urlStr.includes(window.location.host)) {
    const supabaseUrl = localStorage.getItem('finanai_db_url') || '';
    const supabaseKey = localStorage.getItem('finanai_db_key') || '';
    
    if (supabaseUrl && supabaseKey) {
      init = init || {};
      const headers = new Headers(init.headers || {});
      if (!headers.has('x-supabase-url')) {
        headers.set('x-supabase-url', supabaseUrl);
      }
      if (!headers.has('x-supabase-key')) {
        headers.set('x-supabase-key', supabaseKey);
      }
      init.headers = headers;
    }
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