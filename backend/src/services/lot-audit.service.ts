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
        },
      },
    },
  });

  if (!lot) {
    return null;
  }

  // A verificação usa os dados originais do banco.
  // Não modifica nem corrige registros inconsistentes.
  const integrity = verifyBidIntegrity(
    lot.id,
    lot.bids,
    lot.currentBidCents,
  );

  // A apresentação segue os elos da cadeia, e não
  // a ordenação cronológica do banco de dados.
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
    })),
  };
}