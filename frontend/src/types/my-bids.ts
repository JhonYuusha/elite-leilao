import type { LotStatus } from "./lot";

export type MyBidResult =
  | "WON"
  | "LOST"
  | "LEADING"
  | "OUTBID"
  | "PENDING_SETTLEMENT";

export interface MyBidLot {
  id: string;
  title: string;
  imageUrl: string | null;
  status: LotStatus;
  startsAt: string;
  endsAt: string;
  currentBidCents: string | null;
  startingBidCents: string;
  myHighestBidCents: string;
  myLastBidAt: string;
  myBidCount: number;
  isLeading: boolean;
  isWinner: boolean;
  result: MyBidResult;
  settlement: {
    amountCents: string | null;
    settledAt: string;
  } | null;
  receiptToken: string | null;
}

export interface MyBidsResponse {
  lots: MyBidLot[];
}
