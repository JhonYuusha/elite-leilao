export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  LOT_DETAILS: "/lotes/:id",
  AUCTIONEER_DASHBOARD: "/leiloeiro",
  MY_BIDS: "/meus-arremates",
  PUBLIC_RECEIPT: "/comprovantes/:token",
} as const;

export function lotDetailsPath(lotId: string): string {
  return `/lotes/${encodeURIComponent(lotId)}`;
}

export function publicReceiptPath(token: string): string {
  return `/comprovantes/${encodeURIComponent(token)}`;
}