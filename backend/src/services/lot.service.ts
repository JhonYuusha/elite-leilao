import { prisma } from "../lib/prisma.js";
import { getExternalProduct } from "./product.service.js";
import type { CreateLotInput } from "../schemas/lot.schema.js";

export class ExternalProductNotFoundError extends Error {
  constructor() {
    super("Produto externo não encontrado.");
  }
}

export async function createLot(
  auctioneerId: string,
  input: CreateLotInput,
) {
  const product = await getExternalProduct(input.sourceItemId);

  if (!product) {
    throw new ExternalProductNotFoundError();
  }

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  const now = new Date();

  if (endsAt <= now) {
    throw new Error("LOT_ENDS_IN_PAST");
  }

  const status = startsAt <= now ? "LIVE" : "SCHEDULED";

  const lot = await prisma.lot.create({
    data: {
      auctioneerId,
      title: product.title,
      description: product.description,
      imageUrl: product.thumbnail,
      sourceApi: "dummyjson",
      sourceItemId: String(product.id),
      itemSnapshot: product,
      startingBidCents: BigInt(input.startingBidCents),
      minIncrementCents: BigInt(input.minIncrementCents),
      startsAt,
      endsAt,
      status,
    },
  });

  return {
    ...lot,
    startingBidCents: lot.startingBidCents.toString(),
    minIncrementCents: lot.minIncrementCents.toString(),
    currentBidCents: lot.currentBidCents?.toString() ?? null,
  };
}