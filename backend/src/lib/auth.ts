import jwt from "jsonwebtoken";

export type AuthPayload = {
  sub: string;
  role: "AUCTIONEER" | "BIDDER";
};

export function signAccessToken(payload: AuthPayload): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret === "replace-with-a-secure-secret") {
    throw new Error("JWT_SECRET não configurado com segurança.");
  }

  return jwt.sign(
    { role: payload.role },
    secret,
    {
      subject: payload.sub,
      expiresIn: "2h",
      algorithm: "HS256",
    },
  );
}

export function verifyAccessToken(token: string): AuthPayload {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret === "replace-with-a-secure-secret") {
    throw new Error("JWT_SECRET não configurado com segurança.");
  }

  const decoded = jwt.verify(token, secret, {
    algorithms: ["HS256"],
  });

  if (
    typeof decoded === "string" ||
    typeof decoded.sub !== "string" ||
    (decoded.role !== "AUCTIONEER" && decoded.role !== "BIDDER")
  ) {
    throw new Error("Token inválido.");
  }

  return {
    sub: decoded.sub,
    role: decoded.role,
  };
}