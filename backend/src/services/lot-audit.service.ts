import { prisma } from "../lib/prisma.js";

import { orderBidsByChain } from "./bid-chain-order.service.js";
import { verifyBidIntegrity } from "./bid-integrity.service.js";

export async function getPublicLotAudit(lotId: string) {
  const lot = await prisma.lot.findFirst({
    where: {
      id: lotId,
      status: { not: "CANCELLED" },
    },
    select: {
      id: true,
      title: true,
      currentBidCents: true,
      bids: {
        select: {
          id: true,
          lotId: true,
          bidderId: true,
          amountCents: true,
          createdAt: true,
          previousHash: true,
          hash: true,
          hashVersion: true,
        },
      },
    },
  });

  if (!lot) {
    return null;
  }

  // Verifica os dados originais, incluindo a versão
  // criptográfica de cada lance.
  const integrity = verifyBidIntegrity(
    lot.id,
    lot.bids,
    lot.currentBidCents,
  );

  // Apresenta os lances na ordem dos elos da cadeia.
  const orderedBids = orderBidsByChain(lot.bids);

  return {
    lotId: lot.id,
    lotTitle: lot.title,
    totalBids: lot.bids.length,
    currentBidCents:
      lot.currentBidCents?.toString() ?? null,
    integrity,
    bids: orderedBids.map((bid) => ({
      id: bid.id,
      bidderAlias:
        `Participante-${bid.bidderId.slice(0, 8)}`,
      amountCents: bid.amountCents.toString(),
      createdAt: bid.createdAt,
      previousHash: bid.previousHash,
      hash: bid.hash,
      hashVersion: bid.hashVersion,
    })),
  };
}