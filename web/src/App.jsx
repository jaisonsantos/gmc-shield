// web/src/App.jsx

import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Stores from "./pages/Stores";
import Violations from "./pages/Violations";
import Scans from "./pages/Scans";
import Ops from "./pages/Ops";
import WP from "./pages/WP";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
      />
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
      <Route
        path="/stores/:id/wp"
        element={<ProtectedRoute><WP /></ProtectedRoute>}
      />
      {/* ops antes do wildcard, só por legibilidade */}
      <Route
        path="/ops"
        element={<ProtectedRoute><Ops /></ProtectedRoute>}
      />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
