
import { useQuery } from "@tanstack/react-query";

import { USER_ROLES } from "../constants/auction";
import { api } from "../lib/api";
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

  return useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !isLoading && user?.role === USER_ROLES.BIDDER,

    queryFn: async () => {
      const { data } = await api.get<WalletResponse>("/wallet");

      return data.wallet;
    },

    refetchInterval: 15000,
  });
}