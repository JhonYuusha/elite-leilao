import { useNavigate } from "react-router-dom";

import { ROUTES } from "../constants/routes";
import { useAuth } from "./useAuth";

export function useLogout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate(ROUTES.LOGIN, { replace: true });
  }

  return handleLogout;
}