import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import { useQueryClient } from "@tanstack/react-query";

import {
  api,
  getSessionVersion,
  invalidateSession,
  isCurrentSession,
  refreshAccessToken,
  setAccessToken,
  waitForPendingRefresh,
} from "../lib/api";

import { socket } from "../lib/socket";

import type {
  AuthUser,
  LoginResponse,
} from "../types/auth";

import { AuthContext } from "./auth-context";

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const queryClient = useQueryClient();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Serializa operações explícitas de login e logout.
  const authOperation = useRef<Promise<void>>(
    Promise.resolve(),
  );

  const runAuthOperation = useCallback(
    (operation: () => Promise<void>): Promise<void> => {
      const next = authOperation.current.then(
        operation,
        operation,
      );

      authOperation.current = next.catch(() => {});

      return next;
    },
    [],
  );

  const logout = useCallback(() => {
    // Invalida imediatamente o access token.
    invalidateSession();

    queryClient.clear();
    setUser(null);

    socket.disconnect();
    socket.auth = {};

    void runAuthOperation(async () => {
      // Aguarda qualquer refresh iniciado anteriormente.
      await waitForPendingRefresh();

      // Revoga a sessão no backend.
      await api.post("/auth/logout");
    }).catch((error: unknown) => {
      console.error(
        "Falha ao encerrar a sessão no servidor:",
        error,
      );
    });
  }, [queryClient, runAuthOperation]);

  useEffect(() => {
    let active = true;

    const version = getSessionVersion();

    async function restoreSession() {
      try {
        const token = await refreshAccessToken();

        if (!active || !isCurrentSession(version)) {
          return;
        }

        if (!token) {
          setUser(null);
          return;
        }

        const response = await api.get<{
          user: AuthUser;
        }>("/auth/me");

        if (!active || !isCurrentSession(version)) {
          return;
        }

        setUser(response.data.user);
      } catch {
        if (active && isCurrentSession(version)) {
          invalidateSession();
          queryClient.clear();
          setUser(null);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void restoreSession();

    return () => {
      active = false;
    };
  }, [queryClient]);

  const login = useCallback(
    (email: string, password: string): Promise<void> => {
      return runAuthOperation(async () => {
        // Não permite novo login enquanto houver
        // refresh ou logout pendente nesta aba.
        await waitForPendingRefresh();

        const version = getSessionVersion();

        const { data } = await api.post<LoginResponse>(
          "/auth/login",
          {
            email,
            password,
          },
        );

        if (!isCurrentSession(version)) {
          return;
        }

        invalidateSession();
        queryClient.clear();

        setAccessToken(data.accessToken);
        setUser(data.user);
        setIsLoading(false);
      });
    },
    [queryClient, runAuthOperation],
  );

  useEffect(() => {
    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}