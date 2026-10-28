import { prisma } from "../lib/prisma.js";
import { getExternalProduct } from "./product.service.js";
import type { CreateLotInput } from "../schemas/lot.schema.js";

export class ExternalProductNotFoundError extends Error {
  constructor() {
    super("Produto externo não encontrado.");
    this.name = "ExternalProductNotFoundError";
  }
}

export const publicLotSelect = {
  id: true,
  title: true,
  description: true,
  imageUrl: true,
  startingBidCents: true,
  minIncrementCents: true,
  currentBidCents: true,
  startsAt: true,
  endsAt: true,
  status: true,
  createdAt: true,
} as const;

function serializeLot<
  T extends {
    startingBidCents: bigint;
    minIncrementCents: bigint;
    currentBidCents: bigint | null;
  },
>(lot: T) {
  return {
    ...lot,
    startingBidCents: lot.startingBidCents.toString(),
    minIncrementCents: lot.minIncrementCents.toString(),
    currentBidCents: lot.currentBidCents?.toString() ?? null,
  };
}

/**
 * Consulta o catálogo público.
 * Lotes cancelados não aparecem na listagem.
 */
export async function listPublicLots() {
  const lots = await prisma.lot.findMany({
    where: {
      status: { not: "CANCELLED" },
    },
    select: publicLotSelect,
    orderBy: {
      endsAt: "asc",
    },
  });

  return lots.map(serializeLot);
}

/**
 * Consulta os lotes pertencentes ao leiloeiro.
 * Inclui os dados da liquidação, quando existente.
 */
export async function listAuctioneerLots(
  auctioneerId: string,
) {
  const lots = await prisma.lot.findMany({
    where: {
      auctioneerId,
    },
    select: {
      ...publicLotSelect,
      settlement: {
        select: {
          id: true,
          winnerId: true,
          amountCents: true,
          settledAt: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return lots.map((lot) => ({
    ...serializeLot(lot),
    settlement: lot.settlement
      ? {
          ...lot.settlement,
          amountCents:
            lot.settlement.amountCents?.toString() ?? null,
        }
      : null,
  }));
}

/**
 * Consulta um lote público pelo identificador.
 * Retorna null quando não existir ou estiver cancelado.
 */
export async function getPublicLot(lotId: string) {
  const lot = await prisma.lot.findFirst({
    where: {
      id: lotId,
      status: { not: "CANCELLED" },
    },
    select: publicLotSelect,
  });

  return lot ? serializeLot(lot) : null;
}

/**
 * Cria um lote manual ou importado do catálogo externo.
 */
export async function createLot(
  auctioneerId: string,
  input: CreateLotInput,
) {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  const now = new Date();

  if (endsAt <= now) {
    throw new Error("LOT_ENDS_IN_PAST");
  }

  const status = startsAt <= now ? "LIVE" : "SCHEDULED";

  const financialData = {
    auctioneerId,
    startingBidCents: BigInt(input.startingBidCents),
    minIncrementCents: BigInt(input.minIncrementCents),
    startsAt,
    endsAt,
    status,
  } as const;

  if ("sourceItemId" in input) {
    const product = await getExternalProduct(
      input.sourceItemId,
    );

    if (!product) {
      throw new ExternalProductNotFoundError();
    }

    const lot = await prisma.lot.create({
      data: {
        ...financialData,
        title: product.title,
        description: product.description,
        imageUrl: input.imageUrl ?? product.thumbnail,
        sourceApi: "dummyjson",
        sourceItemId: String(product.id),
        itemSnapshot: product,
      },
    });

    return serializeLot(lot);
  }

  const lot = await prisma.lot.create({
    data: {
      ...financialData,
      title: input.title,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      sourceApi: "manual",
      sourceItemId: crypto.randomUUID(),
      itemSnapshot: {
        title: input.title,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        origin: "manual",
      },
    },
  });

  return serializeLot(lot);
}