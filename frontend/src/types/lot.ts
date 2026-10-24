export type LotStatus = "SCHEDULED" | "LIVE" | "ENDED";

export interface Lot {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  startingBidCents: string;
  minIncrementCents: string;
  currentBidCents: string | null;
  startsAt: string;
  endsAt: string;
  status: LotStatus;
  createdAt: string;
}

export interface LotsResponse {
  lots: Lot[];
}