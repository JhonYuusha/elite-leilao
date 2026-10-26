
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { api, TOKEN_KEY } from "../lib/api";
import type { AuthUser, LoginResponse, MeResponse } from "../types/auth";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    queryClient.clear();
    sessionStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, [queryClient]);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      const token = sessionStorage.getItem(TOKEN_KEY);

      if (!token) {
        if (active) setIsLoading(false);
        return;
      }

      try {
        const { data } = await api.get<MeResponse>("/auth/me");

        if (active) {
          setUser(data.user);
        }
      } catch {
        if (active) {
          queryClient.clear();
          sessionStorage.removeItem(TOKEN_KEY);
          setUser(null);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void restoreSession();

    return () => {
      active = false;
    };
  }, [queryClient]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<LoginResponse>("/auth/login", {
      email,
      password,
    });

    queryClient.clear();
    sessionStorage.setItem(TOKEN_KEY, data.accessToken);
    setUser(data.user);
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}