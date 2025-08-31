// web/src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useTranslation } from 'react-i18next';

export default function ProtectedRoute({ children }) {
  const { ready, isAuthenticated } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();
  if (!ready) return <div style={{ padding: 24 }}>{t('common.loading')}</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}
