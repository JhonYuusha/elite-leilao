
import {
  calculateBidHash,
  BID_HASH_VERSION_LEGACY,
} from "./bid-hash.service.js";

export interface AuditableBid {
  id: string;
  lotId: string;
  bidderId: string;
  amountCents: bigint;
  createdAt: Date;
  previousHash: string | null;
  hash: string;
  hashVersion?: number;
}

export interface IntegrityResult {
  valid: boolean;
  checkedBids: number;
  issues: string[];
  firstHash: string | null;
  lastHash: string | null;
}

export function verifyBidIntegrity(
  lotId: string,
  bids: AuditableBid[],
  currentBidCents: bigint | null,
): IntegrityResult {
  const issues: string[] = [];
  const visited = new Set<string>();

  const byPreviousHash = new Map<
    string | null,
    AuditableBid[]
  >();

  for (const bid of bids) {
    const siblings =
      byPreviousHash.get(bid.previousHash) ?? [];

    siblings.push(bid);
    byPreviousHash.set(bid.previousHash, siblings);
  }

  let previousHash: string | null = null;
  let previousAmount: bigint | null = null;
  let firstHash: string | null = null;
  let lastHash: string | null = null;

  while (true) {
    const candidates: AuditableBid[] =
      byPreviousHash.get(previousHash) ?? [];

    if (candidates.length === 0) {
      break;
    }

    if (candidates.length > 1) {
      issues.push(
        "Foram encontrados lances com o mesmo elo anterior.",
      );
      break;
    }

    const bid = candidates[0];

    if (!bid) {
      break;
    }

    if (visited.has(bid.id)) {
      issues.push(
        "Foi detectado um ciclo na cadeia de lances.",
      );
      break;
    }

    visited.add(bid.id);

    if (bid.lotId !== lotId) {
      issues.push("Um lance pertence a outro lote.");
    }

    try {
      const expectedHash = calculateBidHash(
        {
          lotId: bid.lotId,
          bidderId: bid.bidderId,
          amountCents: bid.amountCents,
          acceptedAt: bid.createdAt,
          previousHash: bid.previousHash,
        },
        bid.hashVersion ?? BID_HASH_VERSION_LEGACY,
      );

      if (expectedHash !== bid.hash) {
        issues.push(`Hash inválido no lance ${bid.id}.`);
      }
    } catch {
      issues.push(
        `Não foi possível verificar o hash do lance ${bid.id}.`,
      );
    }

    if (
      previousAmount !== null &&
      bid.amountCents <= previousAmount
    ) {
      issues.push(
        `Valor não crescente no lance ${bid.id}.`,
      );
    }

    if (firstHash === null) {
      firstHash = bid.hash;
    }

    lastHash = bid.hash;
    previousHash = bid.hash;
    previousAmount = bid.amountCents;
  }

  if (visited.size !== bids.length) {
    issues.push(
      "Existem lances desconectados ou ausentes da cadeia principal.",
    );
  }

  if (
    bids.length === 0 &&
    currentBidCents !== null
  ) {
    issues.push(
      "O lote possui valor atual, mas não possui lances.",
    );
  }

  if (
    bids.length > 0 &&
    previousAmount !== currentBidCents
  ) {
    issues.push(
      "O maior lance registrado não corresponde ao valor atual do lote.",
    );
  }

  return {
    valid: issues.length === 0,
    checkedBids: visited.size,
    issues,
    firstHash,
    lastHash,
  };
}