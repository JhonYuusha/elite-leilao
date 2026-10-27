import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { USER_ROLES } from "../constants/auction";
import { api } from "../lib/api";
import { socket } from "../lib/socket";
import { useAuth } from "./useAuth";

export interface Wallet {
  totalCents: string;
  committedCents: string;
  availableCents: string;
}

interface WalletResponse {
  wallet: Wallet;
}

export function useWallet() {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();

  const userId =
    user?.role === USER_ROLES.BIDDER ? user.id : undefined;

  useEffect(() => {
    if (!userId) {
      return;
    }

    const refreshWallet = () => {
      void queryClient.invalidateQueries({
        queryKey: ["wallet", userId],
      });
    };

    // Revalida após reconexões, inclusive quando o usuário
    // ficou offline e perdeu notificações.
    socket.on("connect", refreshWallet);
    socket.on("wallet:updated", refreshWallet);

    if (socket.connected) {
      refreshWallet();
    }

    return () => {
      socket.off("connect", refreshWallet);
      socket.off("wallet:updated", refreshWallet);
    };
  }, [queryClient, userId]);

  return useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !isLoading && user?.role === USER_ROLES.BIDDER,

    queryFn: async () => {
      const { data } = await api.get<WalletResponse>("/wallet");
      return data.wallet;
    },

    // Polling como recuperação caso eventos sejam perdidos.
    refetchInterval: 15000,
  });
}