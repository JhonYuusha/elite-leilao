import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import {
  calculateBidHash,
  BID_HASH_VERSION_HMAC,
  BID_HASH_VERSION_LEGACY,
} from "../services/bid-hash.service.js";

import {
  verifyBidIntegrity,
  type AuditableBid,
} from "../services/bid-integrity.service.js";

const lotId = randomUUID();
const bidder1 = randomUUID();
const bidder2 = randomUUID();

const testSecret =
  "chave-exclusiva-para-testes-de-integridade-123456789";

const originalSecret = process.env.BID_AUDIT_HMAC_KEY;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.BID_AUDIT_HMAC_KEY;
  } else {
    process.env.BID_AUDIT_HMAC_KEY = originalSecret;
  }
});

function createBid(
  bidderId: string,
  amountCents: bigint,
  previousHash: string | null,
  createdAt: Date,
  hashVersion = BID_HASH_VERSION_LEGACY,
): AuditableBid {
  const hash = calculateBidHash(
    {
      lotId,
      bidderId,
      amountCents,
      acceptedAt: createdAt,
      previousHash,
    },
    hashVersion,
    testSecret,
  );

  return {
    id: randomUUID(),
    lotId,
    bidderId,
    amountCents,
    previousHash,
    hash,
    hashVersion,
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

function createMixedChain() {
  const first = createBid(
    bidder1,
    10000n,
    null,
    new Date("2026-10-28T20:00:00.000Z"),
    BID_HASH_VERSION_LEGACY,
  );

  const second = createBid(
    bidder2,
    12000n,
    first.hash,
    new Date("2026-10-28T20:01:00.000Z"),
    BID_HASH_VERSION_HMAC,
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

    bids[0]!.amountCents = 11000n;

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

    bids[0]!.hash = "a".repeat(64);

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
      [bids[1]!],
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

  it("aceita cadeia mista com SHA-256 e HMAC-SHA256", () => {
    process.env.BID_AUDIT_HMAC_KEY = testSecret;

    const bids = createMixedChain();

    const result = verifyBidIntegrity(
      lotId,
      bids,
      12000n,
    );

    expect(result.valid).toBe(true);
    expect(result.checkedBids).toBe(2);
    expect(result.issues).toHaveLength(0);
  });

  it("detecta alteração no valor de lance HMAC", () => {
    process.env.BID_AUDIT_HMAC_KEY = testSecret;

    const bids = createMixedChain();

    bids[1]!.amountCents = 15000n;

    const result = verifyBidIntegrity(
      lotId,
      bids,
      15000n,
    );

    expect(result.valid).toBe(false);
    expect(
      result.issues.some((issue) =>
        issue.includes("Hash inválido"),
      ),
    ).toBe(true);
  });

  it("rejeita auditoria HMAC sem chave configurada", () => {
    delete process.env.BID_AUDIT_HMAC_KEY;

    const bids = createMixedChain();

    const result = verifyBidIntegrity(
      lotId,
      bids,
      12000n,
    );

    expect(result.valid).toBe(false);
    expect(
      result.issues.some((issue) =>
        issue.includes("Não foi possível verificar"),
      ),
    ).toBe(true);
  });

  it("rejeita versão criptográfica desconhecida", () => {
    process.env.BID_AUDIT_HMAC_KEY = testSecret;

    const bids = createMixedChain();

    bids[1]!.hashVersion = 99;

    const result = verifyBidIntegrity(
      lotId,
      bids,
      12000n,
    );

    expect(result.valid).toBe(false);
    expect(
      result.issues.some((issue) =>
        issue.includes("Não foi possível verificar"),
      ),
    ).toBe(true);
  });

  it("detecta downgrade simples de HMAC para SHA-256", () => {
    process.env.BID_AUDIT_HMAC_KEY = testSecret;

    const bids = createMixedChain();

    // O hash continua sendo HMAC, mas alguém
    // altera a versão declarada para SHA-256.
    bids[1]!.hashVersion = BID_HASH_VERSION_LEGACY;

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

  it("detecta HMAC calculado com chave incorreta", () => {
    process.env.BID_AUDIT_HMAC_KEY =
      "outra-chave-de-teste-com-tamanho-suficiente-123";

    const bids = createMixedChain();

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
});