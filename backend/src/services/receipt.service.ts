import { prisma } from "../lib/prisma.js";

export async function getPublicReceipt(publicToken: string) {
  const receipt = await prisma.receipt.findUnique({
    where: {
      publicToken,
    },
    select: {
      id: true,
      lotId: true,
      winnerAlias: true,
      amountCents: true,
      issuedAt: true,
      lot: {
        select: {
          title: true,
        },
      },
    },
  });

  if (!receipt) {
    return null;
  }

  return {
    id: receipt.id,
    lotId: receipt.lotId,
    lotTitle: receipt.lot.title,
    winnerAlias: receipt.winnerAlias,
    amountCents: receipt.amountCents.toString(),
    issuedAt: receipt.issuedAt,
  };
}