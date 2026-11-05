import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  calculateBidHash,
  BID_HASH_VERSION_LEGACY,
  BID_HASH_VERSION_HMAC,
} from "../services/bid-hash.service.js";

const payload = {
  lotId: randomUUID(),
  bidderId: randomUUID(),
  amountCents: 15000n,
  acceptedAt: new Date("2026-11-05T15:00:00.000Z"),
  previousHash: null,
};

const testSecret = "chave-de-teste-com-mais-de-32-caracteres-123456";

describe("Versionamento criptográfico dos lances", () => {
  it("preserva exatamente o SHA-256 legado", () => {
    const serialized = JSON.stringify({
      lotId: payload.lotId,
      bidderId: payload.bidderId,
      amountCents: payload.amountCents.toString(),
      acceptedAt: payload.acceptedAt.toISOString(),
      previousHash: payload.previousHash,
    });

    const expected = createHash("sha256")
      .update(serialized)
      .digest("hex");

    const actual = calculateBidHash(
      payload,
      BID_HASH_VERSION_LEGACY,
    );

    expect(actual).toBe(expected);
  });

  it("gera um HMAC diferente do hash legado", () => {
    const legacy = calculateBidHash(
      payload,
      BID_HASH_VERSION_LEGACY,
    );

    const hmac = calculateBidHash(
      payload,
      BID_HASH_VERSION_HMAC,
      testSecret,
    );

    expect(hmac).toMatch(/^[a-f0-9]{64}$/);
    expect(hmac).not.toBe(legacy);
  });

  it("detecta alterações no conteúdo protegido pelo HMAC", () => {
    const original = calculateBidHash(
      payload,
      BID_HASH_VERSION_HMAC,
      testSecret,
    );

    const modified = calculateBidHash(
      {
        ...payload,
        amountCents: 20000n,
      },
      BID_HASH_VERSION_HMAC,
      testSecret,
    );

    expect(modified).not.toBe(original);
  });

  it("rejeita HMAC sem chave válida", () => {
    expect(() =>
      calculateBidHash(
        payload,
        BID_HASH_VERSION_HMAC,
        "",
      ),
    ).toThrow("BID_AUDIT_HMAC_KEY ausente ou inválida.");

    expect(() =>
      calculateBidHash(
        payload,
        BID_HASH_VERSION_HMAC,
        "curta",
      ),
    ).toThrow("BID_AUDIT_HMAC_KEY ausente ou inválida.");
  });

  it("rejeita versões desconhecidas", () => {
    expect(() =>
      calculateBidHash(payload, 99, testSecret),
    ).toThrow("Versão de hash não suportada: 99.");
  });
});
