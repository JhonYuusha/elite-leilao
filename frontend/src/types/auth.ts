export type UserRole = "AUCTIONEER" | "BIDDER";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  user: AuthUser;
}

export interface MeResponse {
  user: AuthUser;
}