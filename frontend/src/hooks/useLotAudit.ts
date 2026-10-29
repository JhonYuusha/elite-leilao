import { useQuery } from "@tanstack/react-query";

import { getLotAudit } from "../services/lot-audit.service";

export function useLotAudit(lotId: string) {
  return useQuery({
    queryKey: ["lot-audit", lotId],
    queryFn: () => getLotAudit(lotId),
    enabled: Boolean(lotId),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}
