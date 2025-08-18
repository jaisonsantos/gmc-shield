// web/src/App.jsx

import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./pages/AppShell";
import Login from "./pages/Login";
import Stores from "./pages/Stores";
import Violations from "./pages/Violations";
import Scans from "./pages/Scans";
import Ops from "./pages/Ops";
import WP from "./pages/WP";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route path="/stores" element={<Stores />} />
        <Route path="/stores/:id/violations" element={<Violations />} />
        <Route path="/stores/:id/scans" element={<Scans />} />
        <Route path="/stores/:id/wp" element={<WP />} />
        {/* ops antes do wildcard, só por legibilidade */}
        <Route path="/ops" element={<Ops />} />
      </Route>

      <Route path="*" element={<Navigate to="/stores" />} />
    </Routes>
  );
}
