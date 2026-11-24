import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import RootLayout from "./layouts/RootLayout";
import Dashboard from "./pages/Home";
import FreezerAI from "./pages/FreezerAI";
import Login from "./pages/Login";
import Prestadores from "./features/prestadores";
import Freezers from "./features/freezers";
import FreezerDetailsPage from "./features/freezers/FreezerDetails";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<RootLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="freezers" element={<Freezers />} />
            <Route path="freezers/:freezerId" element={<FreezerDetailsPage />} />
            <Route path="freezer-ai" element={<FreezerAI />} />
            <Route path="prestadores" element={<Prestadores />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
