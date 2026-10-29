import { api } from "../lib/api";
import type {
  LotAudit,
  LotAuditResponse,
} from "../types/lot-audit";

export async function getLotAudit(
  lotId: string,
): Promise<LotAudit> {
  const { data } = await api.get<LotAuditResponse>(
    `/lots/${encodeURIComponent(lotId)}/audit`,
  );

  return data.audit;
}
