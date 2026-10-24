import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Lot } from "../types/lot";

interface LotResponse {
  lot: Lot;
}

export function useLot(id: string | undefined) {
  return useQuery({
    queryKey: ["lot", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data } = await api.get<LotResponse>(
        `/lots/${encodeURIComponent(id!)}`,
      );

      return data.lot;
    },
    refetchInterval: 15000,
  });
}