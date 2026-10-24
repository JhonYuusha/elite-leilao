import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { LotsResponse } from "../types/lot";

export function useLots() {
  return useQuery({
    queryKey: ["lots"],
    queryFn: async () => {
      const { data } = await api.get<LotsResponse>("/lots");
      return data.lots;
    },
    refetchInterval: 15000,
  });
}