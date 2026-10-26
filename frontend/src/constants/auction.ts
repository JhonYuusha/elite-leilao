import type { LotStatus } from "../types/lot";

export const USER_ROLES = {
  AUCTIONEER: "AUCTIONEER",
  BIDDER: "BIDDER",
} as const;

export const LOT_STATUS = {
  SCHEDULED: "SCHEDULED",
  LIVE: "LIVE",
  ENDED: "ENDED",
  CANCELLED: "CANCELLED",
} as const satisfies Record<LotStatus, LotStatus>;

export type LotFilter = "ALL" | LotStatus;
export type ManagementAction = "cancel" | "settle";

export const LOT_FILTERS: Array<{
  value: LotFilter;
  label: string;
}> = [
  { value: "ALL", label: "TODOS" },
  { value: LOT_STATUS.LIVE, label: "AO VIVO" },
  { value: LOT_STATUS.SCHEDULED, label: "AGENDADOS" },
  { value: LOT_STATUS.ENDED, label: "ENCERRADOS" },
  { value: LOT_STATUS.CANCELLED, label: "CANCELADOS" },
];

export const LOT_STATUS_LABELS: Record<LotStatus, string> = {
  SCHEDULED: "AGENDADO",
  LIVE: "AO VIVO",
  ENDED: "ENCERRADO",
  CANCELLED: "CANCELADO",
};