import { BrowserRouter, Route, Routes } from "react-router";
import RootLayout from "./layouts/RootLayout";
import Dashboard from "./pages/Home";
import FreezerAI from "./pages/FreezerAI";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="freezer-ai" element={<FreezerAI />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
