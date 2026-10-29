export interface PublicReceiptData {
  id: string;
  lotId: string;
  lotTitle: string;
  winnerAlias: string;
  amountCents: string;
  issuedAt: string;
}

export interface PublicReceiptResponse {
  receipt: PublicReceiptData;
}
