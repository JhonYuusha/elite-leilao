import { BrowserRouter } from "react-router-dom";

import { AppRoutes } from "./app/AppRoutes";
import { AuthProvider } from "./contexts/AuthContext";

import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;