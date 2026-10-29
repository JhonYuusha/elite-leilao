import { prisma } from "../lib/prisma.js";

export async function listMyBids(bidderId: string) {
  const myBids = await prisma.bid.findMany({
    where: { bidderId },
    select: {
      lotId: true,
      amountCents: true,
      createdAt: true,
    },
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
  });

  const participation = new Map<
    string,
    {
      myHighestBidCents: bigint;
      myLastBidAt: Date;
      myBidCount: number;
    }
  >();

  for (const bid of myBids) {
    const current = participation.get(bid.lotId);

    if (!current) {
      participation.set(bid.lotId, {
        myHighestBidCents: bid.amountCents,
        myLastBidAt: bid.createdAt,
        myBidCount: 1,
      });
      continue;
    }

    current.myBidCount += 1;

    if (bid.amountCents > current.myHighestBidCents) {
      current.myHighestBidCents = bid.amountCents;
    }
  }

  const lotIds = [...participation.keys()];

  if (lotIds.length === 0) {
    return [];
  }

  const lots = await prisma.lot.findMany({
    where: {
      id: { in: lotIds },
    },
    select: {
      id: true,
      title: true,
      imageUrl: true,
      status: true,
      startsAt: true,
      endsAt: true,
      currentBidCents: true,
      startingBidCents: true,
      settlement: {
        select: {
          winnerId: true,
          amountCents: true,
          settledAt: true,
        },
      },
      receipt: {
        select: {
          publicToken: true,
          issuedAt: true,
        },
      },
      bids: {
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" },
        ],
        take: 1,
        select: {
          bidderId: true,
        },
      },
    },
  });

  const now = Date.now();

  return lots
    .map((lot) => {
      const mine = participation.get(lot.id)!;
      const isLeading =
        lot.bids[0]?.bidderId === bidderId;

      const isSettled = lot.settlement !== null;
      const isWinner =
        isSettled &&
        lot.settlement?.winnerId === bidderId;

      const isExpired =
        new Date(lot.endsAt).getTime() <= now;

      let result:
        | "WON"
        | "LOST"
        | "LEADING"
        | "OUTBID"
        | "PENDING_SETTLEMENT";

      if (isWinner) {
        result = "WON";
      } else if (isSettled) {
        result = "LOST";
      } else if (isExpired && isLeading) {
        result = "PENDING_SETTLEMENT";
      } else if (isLeading) {
        result = "LEADING";
      } else {
        result = "OUTBID";
      }

      return {
        id: lot.id,
        title: lot.title,
        imageUrl: lot.imageUrl,
        status: lot.status,
        startsAt: lot.startsAt,
        endsAt: lot.endsAt,
        currentBidCents:
          lot.currentBidCents?.toString() ?? null,
        startingBidCents:
          lot.startingBidCents.toString(),
        myHighestBidCents:
          mine.myHighestBidCents.toString(),
        myLastBidAt: mine.myLastBidAt,
        myBidCount: mine.myBidCount,
        isLeading,
        isWinner,
        result,
        settlement: isWinner && lot.settlement
          ? {
              amountCents:
                lot.settlement.amountCents?.toString()
                ?? null,
              settledAt: lot.settlement.settledAt,
            }
          : null,
        receiptToken:
          isWinner ? lot.receipt?.publicToken ?? null : null,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.myLastBidAt).getTime() -
        new Date(a.myLastBidAt).getTime(),
    );
}
