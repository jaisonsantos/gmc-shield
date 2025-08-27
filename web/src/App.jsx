// web/src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./pages/AppShell";
import Login from "./pages/Login";
import WebSite from "./WebSite";
import Dashboard from "./pages/Dashboard";
import Stores from "./pages/Stores";
import Items from "./pages/Items";
import Policies from "./pages/Policies";
import Appeals from "./pages/Appeals";
import Feeds from "./pages/Feeds";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import Billing from "./pages/Billing";
import Agency from "./pages/Agency";
import Ops from "./pages/Ops";
import Violations from "./pages/Violations";
import Scans from "./pages/Scans";
import WP from "./pages/WP";
import StoreLayout from "./components/StoreLayout"; // 1. Importar o novo layout

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<WebSite />} />
      <Route path="/login" element={<Login />} />

      <Route path="/app" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="stores" element={<Stores />} />
        
        {/* 2. Criar um grupo de rotas para a loja */}
        <Route path="stores/:id" element={<StoreLayout />}>
          {/* A página inicial de uma loja será a de violações */}
          <Route index element={<Navigate to="violations" replace />} />
          <Route path="violations" element={<Violations />} />
          <Route path="scans" element={<Scans />} />
          <Route path="feeds" element={<Feeds />} />
          <Route path="items" element={<Items />} />
          <Route path="wp" element={<WP />} />
        </Route>

        <Route path="policies" element={<Policies />} />
        <Route path="appeals" element={<Appeals />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<Settings />} />
        <Route path="billing" element={<Billing />} />
        <Route path="agency" element={<Agency />} />
        <Route path="ops" element={<Ops />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}