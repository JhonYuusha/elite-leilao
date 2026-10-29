import {
  Gavel,
  LayoutDashboard,
  LogIn,
  LogOut,
  UserRound,
} from "lucide-react";
import { Link } from "react-router-dom";

import { USER_ROLES } from "../constants/auction";
import { ROUTES } from "../constants/routes";
import { useAuth } from "../hooks/useAuth";
import { useLogout } from "../hooks/useLogout";

import "../styles/components/AccountMenu.css";

export function AccountMenu() {
  const { user, isLoading } = useAuth();
  const handleLogout = useLogout();

  if (isLoading) return null;

  if (!user) {
    return (
      <Link to={ROUTES.LOGIN} className="account-login">
        <LogIn size={16} />
        ENTRAR
      </Link>
    );
  }

  const isAuctioneer =
    user.role === USER_ROLES.AUCTIONEER;

  return (
    <div className="account-menu">
      <div className="account-identity">
        <UserRound size={17} />
        <div>
          <strong>{user.name}</strong>
          <span>
            {isAuctioneer ? "LEILOEIRO" : "PARTICIPANTE"}
          </span>
        </div>
      </div>

      <Link
        to={
          isAuctioneer
            ? ROUTES.AUCTIONEER_DASHBOARD
            : ROUTES.MY_BIDS
        }
        className="account-dashboard"
        title={
          isAuctioneer
            ? "Acessar painel do leiloeiro"
            : "Consultar meus arremates"
        }
      >
        {isAuctioneer ? (
          <LayoutDashboard size={16} />
        ) : (
          <Gavel size={16} />
        )}
        {isAuctioneer ? "PAINEL" : "MEUS ARREMATES"}
      </Link>

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