
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./contexts/AuthContext";
import { AuctioneerDashboard } from "./pages/AuctioneerDashboard";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { LotDetails } from "./pages/LotDetails";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/lotes/:id" element={<LotDetails />} />
          <Route path="/leiloeiro" element={<AuctioneerDashboard />} />

          <Route
            path="*"
            element={
              <main className="not-found">
                <h1>PÁGINA NÃO ENCONTRADA.</h1>
                <Link to="/">VOLTAR AO INÍCIO</Link>
              </main>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;