import { BrowserRouter } from "react-router-dom";

import { AppRoutes } from "./app/AppRoutes";
import { SplashScreen } from "./components/SplashScreen";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./hooks/useAuth";
import { useMinimumLoading } from "./hooks/useMinimumLoading";

import "./styles/global/App.css";

function AppContent() {
  const { isLoading } = useAuth();

  const showSplash = useMinimumLoading(isLoading, 1500);

  if (showSplash) {
    return <SplashScreen />;
  }

  return <AppRoutes />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;