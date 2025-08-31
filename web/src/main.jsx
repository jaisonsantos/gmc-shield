// web/src/main.jsx

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./lib/auth.jsx";
import { ToastProvider } from "./lib/toast.jsx";
import "./global.css";
import "./i18n";
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import { Suspense } from 'react';
import { ThemeProvider } from './lib/theme.jsx';

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <I18nextProvider i18n={i18n}>
              <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
                <App />
              </Suspense>
            </I18nextProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
