import { prisma } from "../lib/prisma.js";

export async function getLotBidHistory(lotId: string) {
  const lot = await prisma.lot.findFirst({
    where: {
      id: lotId,
      status: {
        not: "CANCELLED",
      },
    },
    select: {
      id: true,
      title: true,
      currentBidCents: true,
      bids: {
        select: {
          id: true,
          bidderId: true,
          amountCents: true,
          createdAt: true,
          hash: true,
          previousHash: true,
        },
        orderBy: [
          { createdAt: "asc" },
          { id: "asc" },
        ],
      },
    },
  });

  if (!lot) {
    return null;
  }

  const bids = lot.bids.map((bid, index) => ({
    id: bid.id,
    position: index + 1,
    bidderAlias: `Participante-${bid.bidderId.slice(0, 8)}`,
    amountCents: bid.amountCents.toString(),
    createdAt: bid.createdAt,
    hash: bid.hash,
    previousHash: bid.previousHash,
  }));

  return {
    lotId: lot.id,
    lotTitle: lot.title,
    currentBidCents:
      lot.currentBidCents?.toString() ?? null,
    totalBids: bids.length,
    bids,
  };
}
