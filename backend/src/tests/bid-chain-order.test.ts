import { describe, expect, it } from "vitest";

import {
  orderBidsByChain,
  type ChainBid,
} from "../services/bid-chain-order.service.js";

function makeBid(
  id: string,
  hash: string,
  previousHash: string | null,
  time: string,
): ChainBid {
  return {
    id,
    hash,
    previousHash,
    createdAt: new Date(time),
  };
}

describe("Ordenação criptográfica dos lances", () => {
  it("segue a cadeia mesmo com datas fora de ordem", () => {
    const first = makeBid(
      "1",
      "hash-1",
      null,
      "2026-10-28T20:03:00Z",
    );

    const second = makeBid(
      "2",
      "hash-2",
      "hash-1",
      "2026-10-28T20:01:00Z",
    );

    const third = makeBid(
      "3",
      "hash-3",
      "hash-2",
      "2026-10-28T20:02:00Z",
    );

    const result = orderBidsByChain([
      third,
      first,
      second,
    ]);

    expect(result.map((bid) => bid.id)).toEqual([
      "1",
      "2",
      "3",
    ]);
  });

  it("não descarta lances desconectados", () => {
    const first = makeBid(
      "1",
      "hash-1",
      null,
      "2026-10-28T20:00:00Z",
    );

    const orphan = makeBid(
      "2",
      "hash-2",
      "hash-inexistente",
      "2026-10-28T20:01:00Z",
    );

    const result = orderBidsByChain([
      orphan,
      first,
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((bid) => bid.id)).toEqual([
      "1",
      "2",
    ]);
  });

  it("preserva ramificações da cadeia", () => {
    const first = makeBid(
      "1",
      "hash-1",
      null,
      "2026-10-28T20:00:00Z",
    );

    const second = makeBid(
      "2",
      "hash-2",
      "hash-1",
      "2026-10-28T20:01:00Z",
    );

    const third = makeBid(
      "3",
      "hash-3",
      "hash-1",
      "2026-10-28T20:02:00Z",
    );

    const result = orderBidsByChain([
      third,
      second,
      first,
    ]);

    expect(result.map((bid) => bid.id)).toEqual([
      "1",
      "2",
      "3",
    ]);
  });

  it("não entra em loop quando existe ciclo", () => {
    const first = makeBid(
      "1",
      "hash-1",
      "hash-2",
      "2026-10-28T20:00:00Z",
    );

    const second = makeBid(
      "2",
      "hash-2",
      "hash-1",
      "2026-10-28T20:01:00Z",
    );

    const result = orderBidsByChain([
      first,
      second,
    ]);

    expect(result).toHaveLength(2);
    expect(new Set(result.map((bid) => bid.id)).size)
      .toBe(2);
  });

  it("não altera o array original", () => {
    const first = makeBid(
      "1",
      "hash-1",
      null,
      "2026-10-28T20:00:00Z",
    );

    const second = makeBid(
      "2",
      "hash-2",
      "hash-1",
      "2026-10-28T20:01:00Z",
    );

    const original = [second, first];

    orderBidsByChain(original);

    expect(original.map((bid) => bid.id)).toEqual([
      "2",
      "1",
    ]);
  });
});
