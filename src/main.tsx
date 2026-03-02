import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');

// Global Error Handler for LocalStorage Corruption
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