// web/src/App.jsx

import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./pages/AppShell";
import Login from "./pages/Login";
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
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="stores" element={<Stores />} />
        <Route path="items" element={<Items />} />
        <Route path="policies" element={<Policies />} />
        <Route path="appeals" element={<Appeals />} />
        <Route path="feeds" element={<Feeds />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<Settings />} />
        <Route path="billing" element={<Billing />} />
        <Route path="agency" element={<Agency />} />
        <Route path="ops" element={<Ops />} />
        <Route path="stores/:id/violations" element={<Violations />} />
        <Route path="stores/:id/scans" element={<Scans />} />
        <Route path="stores/:id/wp" element={<WP />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
