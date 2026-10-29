export interface AuditedBid {
  id: string;
  bidderAlias: string;
  amountCents: string;
  createdAt: string;
  previousHash: string | null;
  hash: string;
}

export interface BidIntegrityResult {
  valid: boolean;
  checkedBids: number;
  issues: string[];
  firstHash: string | null;
  lastHash: string | null;
}

export interface LotAudit {
  lotId: string;
  lotTitle: string;
  totalBids: number;
  currentBidCents: string | null;
  integrity: BidIntegrityResult;
  bids: AuditedBid[];
}

export interface LotAuditResponse {
  audit: LotAudit;
}
