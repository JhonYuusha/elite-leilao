import { prisma } from "../lib/prisma.js";
import { getExternalProduct } from "./product.service.js";
import type { CreateLotInput } from "../schemas/lot.schema.js";

export class ExternalProductNotFoundError extends Error {
  constructor() {
    super("Produto externo não encontrado.");
    this.name = "ExternalProductNotFoundError";
  }
}

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
    const product = await getExternalProduct(input.sourceItemId);

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