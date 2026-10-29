import { useQuery } from "@tanstack/react-query";

import { getLotBidHistory } from "../services/bid-history.service";

export function useLotBidHistory(lotId?: string) {
  return useQuery({
    queryKey: ["lot-bid-history", lotId],
    queryFn: () => getLotBidHistory(lotId!),
    enabled: Boolean(lotId),
    refetchInterval: 15000,
  });
}
