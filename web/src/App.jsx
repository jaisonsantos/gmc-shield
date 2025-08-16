// web/src/App.jsx

import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Stores from "./pages/Stores";
import Violations from "./pages/Violations";
import Scans from "./pages/Scans";
import Ops from "./pages/Ops";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/stores"
        element={<ProtectedRoute><Stores /></ProtectedRoute>}
      />
      <Route
        path="/stores/:id/violations"
        element={<ProtectedRoute><Violations /></ProtectedRoute>}
      />
      <Route
        path="/stores/:id/scans"
        element={<ProtectedRoute><Scans /></ProtectedRoute>}
      />
      {/* ops antes do wildcard, só por legibilidade */}
      <Route
        path="/ops"
        element={<ProtectedRoute><Ops /></ProtectedRoute>}
      />

      <Route path="*" element={<Navigate to="/stores" />} />
    </Routes>
  );
}
