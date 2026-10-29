import { api } from "../lib/api";
import type {
  LotBidHistory,
  LotBidHistoryResponse,
} from "../types/bid-history";

export async function getLotBidHistory(
  lotId: string,
): Promise<LotBidHistory> {
  const { data } = await api.get<LotBidHistoryResponse>(
    `/lots/${encodeURIComponent(lotId)}/bids`,
  );

  return data.history;
}
