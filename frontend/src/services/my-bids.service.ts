import { api } from "../lib/api";
import type {
  MyBidLot,
  MyBidsResponse,
} from "../types/my-bids";

export async function getMyBids(): Promise<MyBidLot[]> {
  const { data } = await api.get<MyBidsResponse>(
    "/bids/mine",
  );

  return data.lots;
}