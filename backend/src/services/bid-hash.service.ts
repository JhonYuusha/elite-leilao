import { createHash, createHmac } from "node:crypto";

export const BID_HASH_VERSION_LEGACY = 1;
export const BID_HASH_VERSION_HMAC = 2;

export interface BidHashPayload {
  lotId: string;
  bidderId: string;
  amountCents: bigint;
  acceptedAt: Date;
  previousHash: string | null;
}

export function calculateBidHash(
  payload: BidHashPayload,
  version: number,
  secret = process.env.BID_AUDIT_HMAC_KEY,
): string {
  const serialized = JSON.stringify({
    lotId: payload.lotId,
    bidderId: payload.bidderId,
    amountCents: payload.amountCents.toString(),
    acceptedAt: payload.acceptedAt.toISOString(),
    previousHash: payload.previousHash,
  });

  if (version === BID_HASH_VERSION_LEGACY) {
    return createHash("sha256")
      .update(serialized)
      .digest("hex");
  }

  if (version === BID_HASH_VERSION_HMAC) {
  if (!secret || secret.length < 32) {
    throw new Error(
      "BID_AUDIT_HMAC_KEY ausente ou inválida.",
    );
  }

  return createHmac("sha256", secret)
    .update(`aureo:bid:v2:${serialized}`)
    .digest("hex");
}

  throw new Error(
    `Versão de hash não suportada: ${version}.`,
  );
}
