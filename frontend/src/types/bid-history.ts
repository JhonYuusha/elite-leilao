export interface PublicBid {
  id: string;
  position: number;
  bidderAlias: string;
  amountCents: string;
  createdAt: string;
  hash: string;
  previousHash: string | null;
}

export interface LotBidHistory {
  lotId: string;
  lotTitle: string;
  currentBidCents: string | null;
  totalBids: number;
  bids: PublicBid[];
}

export interface LotBidHistoryResponse {
  history: LotBidHistory;
}
