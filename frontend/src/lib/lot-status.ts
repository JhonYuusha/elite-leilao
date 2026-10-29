import type { Lot } from "../types/lot";

export type PublicLotStatus = "LIVE" | "SCHEDULED" | "ENDED";

export function getEffectiveLotStatus(
  lot: Lot,
  now: number | null,
): PublicLotStatus | "CANCELLED" | null {
  if (lot.status === "CANCELLED") return "CANCELLED";
  if (lot.status === "ENDED") return "ENDED";

  if (now === null) return null;

  const startsAt = Date.parse(lot.startsAt);
  const endsAt = Date.parse(lot.endsAt);

  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    return null;
  }

  if (now >= endsAt) return "ENDED";
  if (now < startsAt) return "SCHEDULED";

  return "LIVE";
}
