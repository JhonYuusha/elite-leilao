
import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  verifyBidIntegrity,
  type AuditableBid,
} from "../services/bid-integrity.service.js";

const lotId = randomUUID();
const bidder1 = randomUUID();
const bidder2 = randomUUID();

function createBid(
  bidderId: string,
  amountCents: bigint,
  previousHash: string | null,
  createdAt: Date,
): AuditableBid {
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        lotId,
        bidderId,
        amountCents: amountCents.toString(),
        acceptedAt: createdAt.toISOString(),
        previousHash,
      }),
    )
    .digest("hex");

  return {
    id: randomUUID(),
    lotId,
    bidderId,
    amountCents,
    previousHash,
    hash,
    createdAt,
  };
}

function createValidChain() {
  const first = createBid(
    bidder1,
    10000n,
    null,
    new Date("2026-10-28T20:00:00.000Z"),
  );

  const second = createBid(
    bidder2,
    12000n,
    first.hash,
    new Date("2026-10-28T20:01:00.000Z"),
  );

  return [first, second];
}

describe("Verificação criptográfica dos lances", () => {
  it("aceita uma cadeia íntegra", () => {
    const bids = createValidChain();

    const result = verifyBidIntegrity(
      lotId,
      bids,
      12000n,
    );

    expect(result.valid).toBe(true);
    expect(result.checkedBids).toBe(2);
    expect(result.issues).toHaveLength(0);
  });

  it("detecta alteração direta no valor de um lance", () => {
    const bids = createValidChain();

    bids[0].amountCents = 11000n;

    const result = verifyBidIntegrity(
      lotId,
      bids,
      12000n,
    );

    expect(result.valid).toBe(false);
    expect(
      result.issues.some((issue) =>
        issue.includes("Hash inválido"),
      ),
    ).toBe(true);
  });

  it("detecta alteração do hash", () => {
    const bids = createValidChain();

    bids[0].hash = "a".repeat(64);

    const result = verifyBidIntegrity(
      lotId,
      bids,
      12000n,
    );

    expect(result.valid).toBe(false);
  });

  it("detecta remoção de um lance intermediário", () => {
    const bids = createValidChain();

    const result = verifyBidIntegrity(
      lotId,
      [bids[1]],
      12000n,
    );

    expect(result.valid).toBe(false);
  });

  it("detecta divergência do valor atual do lote", () => {
    const bids = createValidChain();

    const result = verifyBidIntegrity(
      lotId,
      bids,
      99999n,
    );

    expect(result.valid).toBe(false);
  });

  it("aceita lote sem lances e sem valor atual", () => {
    const result = verifyBidIntegrity(
      lotId,
      [],
      null,
    );

    expect(result.valid).toBe(true);
    expect(result.checkedBids).toBe(0);
  });
});
