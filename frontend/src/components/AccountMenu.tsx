import {
  LayoutDashboard,
  LogIn,
  LogOut,
  UserRound,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import "./AccountMenu.css";

export function AccountMenu() {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  if (isLoading) {
    return null;
  }

  if (!user) {
    return (
      <Link to="/login" className="account-login">
        <LogIn size={16} />
        ENTRAR
      </Link>
    );
  }

  return (
    <div className="account-menu">
      <div className="account-identity">
        <UserRound size={17} />

        <div>
          <strong>{user.name}</strong>
          <span>
            {user.role === "AUCTIONEER"
              ? "LEILOEIRO"
              : "PARTICIPANTE"}
          </span>
        </div>
      </div>

      {user.role === "AUCTIONEER" && (
        <Link
          to="/leiloeiro"
          className="account-dashboard"
          title="Acessar painel do leiloeiro"
        >
          <LayoutDashboard size={16} />
          PAINEL
        </Link>
      )}

      <button
        type="button"
        className="account-logout"
        onClick={handleLogout}
        title="Desconectar da conta"
      >
        <LogOut size={16} />
        SAIR
      </button>
    </div>
  );
}