export type LotStatus = "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";

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

export interface ManagedLot extends Lot {
  settlement: {
    id: string;
    winnerId: string | null;
    amountCents: string | null;
    settledAt: string;
  } | null;
}

export interface ManagedLotsResponse {
  lots: ManagedLot[];
}