import { LOT_STATUS } from "../constants/auction";
import type { ManagedLot, LotStatus } from "../types/lot";

export function toIso(localDateTime: string): string | null {
  const date = new Date(localDateTime);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
}

export function effectiveStatus(
  lot: ManagedLot,
  now: number,
): LotStatus {
  if (
    lot.status === LOT_STATUS.CANCELLED ||
    lot.status === LOT_STATUS.ENDED
  ) {
    return lot.status;
  }

  if (Date.parse(lot.endsAt) <= now) {
    return LOT_STATUS.ENDED;
  }

  if (Date.parse(lot.startsAt) > now) {
    return LOT_STATUS.SCHEDULED;
  }

  return LOT_STATUS.LIVE;
}

export function canCancelLot(
  lot: ManagedLot,
  now: number,
): boolean {
  const status = effectiveStatus(lot, now);

  return (
    lot.currentBidCents === null &&
    (status === LOT_STATUS.LIVE ||
      status === LOT_STATUS.SCHEDULED)
  );
}

export function canSettleLot(
  lot: ManagedLot,
  now: number,
): boolean {
  return (
    effectiveStatus(lot, now) === LOT_STATUS.ENDED &&
    lot.status !== LOT_STATUS.CANCELLED &&
    lot.settlement === null
  );
}

export function totalReceivedCents(
  lots: ManagedLot[],
): string {
  const total = lots.reduce(
    (sum, lot) =>
      sum + BigInt(lot.settlement?.amountCents ?? "0"),
    0n,
  );

  return total.toString();
}