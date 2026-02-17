import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('root element not found');

/** OIDC 不允许 redirect_uri 带 fragment，Logto 回调到 path /logto-callback?code=...；此处转到 hash 以便 HashRouter 匹配 */
if (typeof window !== 'undefined' && window.location.pathname === '/logto-callback' && window.location.search) {
  window.location.replace(window.location.origin + '/#/logto-callback' + window.location.search);
} else {
createRoot(container).render(
  <React.StrictMode>
    <HashRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <App />
    </HashRouter>
  </React.StrictMode>
);
}
