export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  LOT_DETAILS: "/lotes/:id",
  AUCTIONEER_DASHBOARD: "/leiloeiro",
} as const;

export function lotDetailsPath(lotId: string): string {
  return `/lotes/${encodeURIComponent(lotId)}`;
}