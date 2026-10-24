import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";
import { LotDetails } from "./pages/LotDetails";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lotes/:id" element={<LotDetails />} />
        <Route
          path="*"
          element={
            <main className="not-found">
              <h1>PÁGINA NÃO ENCONTRADA.</h1>
              <a href="/">VOLTAR AO INÍCIO</a>
            </main>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;