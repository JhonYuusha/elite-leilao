import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

const MAX_BIGINT = 9223372036854775807n;

export class WalletNotFoundError extends Error {
  constructor() {
    super("Carteira não encontrada.");
    this.name = "WalletNotFoundError";
  }
}

export class WalletLimitError extends Error {
  constructor() {
    super("O depósito excede o limite da carteira.");
    this.name = "WalletLimitError";
  }
}

function serializeWallet(wallet: {
  totalCents: bigint;
  committedCents: bigint;
}) {
  return {
    totalCents: wallet.totalCents.toString(),
    committedCents: wallet.committedCents.toString(),
    availableCents: (
      wallet.totalCents - wallet.committedCents
    ).toString(),
  };
}

export async function getWallet(userId: string) {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
  });

  if (!wallet) {
    throw new WalletNotFoundError();
  }

  return serializeWallet(wallet);
}

export async function deposit(
  userId: string,
  amountCents: bigint,
) {
  return prisma.$transaction(
    async (tx) => {
      // Bloqueia a carteira durante a operação financeira.
      const rows = await tx.$queryRaw<
        Array<{ id: string; totalCents: bigint }>
      >`
        SELECT id, "totalCents"
        FROM "Wallet"
        WHERE "userId" = ${userId}
        FOR UPDATE
      `;

      const wallet = rows[0];

      if (!wallet) {
        throw new WalletNotFoundError();
      }

      if (amountCents > MAX_BIGINT - wallet.totalCents) {
        throw new WalletLimitError();
      }

      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          totalCents: {
            increment: amountCents,
          },
        },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          userId,
          type: "DEPOSIT",
          amountCents,
        },
      });

      return {
        wallet: serializeWallet(updated),
        transaction: {
          id: transaction.id,
          type: transaction.type,
          amountCents: transaction.amountCents.toString(),
          createdAt: transaction.createdAt,
        },
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 10000,
    },
  );
}

export async function getWalletTransactions(userId: string) {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!wallet) {
    throw new WalletNotFoundError();
  }

  const transactions = await prisma.walletTransaction.findMany({
    where: { userId },
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: 100,
  });

  return transactions.map((transaction) => ({
    id: transaction.id,
    type: transaction.type,
    amountCents: transaction.amountCents.toString(),
    lotId: transaction.lotId,
    createdAt: transaction.createdAt,
  }));
}