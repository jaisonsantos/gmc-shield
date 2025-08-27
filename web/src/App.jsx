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

export default function App() {
  return (
    <Routes>
      {/* Public landing page */}
      <Route path="/" element={<WebSite />} />

      {/* Login page */}
      <Route path="/login" element={<Login />} />

      {/* Protected application routes */}
      <Route path="/app" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="stores" element={<Stores />} />
        <Route path="policies" element={<Policies />} />
        <Route path="appeals" element={<Appeals />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<Settings />} />
        <Route path="billing" element={<Billing />} />
        <Route path="agency" element={<Agency />} />
        <Route path="ops" element={<Ops />} />
        <Route path="stores/:id/violations" element={<Violations />} />
        <Route path="stores/:id/scans" element={<Scans />} />
        <Route path="stores/:id/wp" element={<WP />} />
        <Route path="stores/:id/feeds" element={<Feeds />} />
        <Route path="stores/:id/items" element={<Items />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
