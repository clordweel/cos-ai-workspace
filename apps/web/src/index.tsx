import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppViewProvider } from './contexts/AppViewContext';
import App from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('root element not found');
createRoot(container).render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AppViewProvider>
        <App />
      </AppViewProvider>
    </BrowserRouter>
  </React.StrictMode>
);
