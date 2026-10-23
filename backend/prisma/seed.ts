import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não configurada.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed de demonstração bloqueado em produção.");
  }

  const passwordHash = await bcrypt.hash("Demo@123456", 12);

  const auctioneer = await prisma.user.upsert({
    where: { email: "leiloeiro@demo.local" },
    update: {},
    create: {
      name: "Leiloeiro Demo",
      email: "leiloeiro@demo.local",
      passwordHash,
      role: "AUCTIONEER",
    },
  });

  const bidders = [];

  for (const number of [1, 2]) {
    const bidder = await prisma.user.upsert({
      where: { email: `participante${number}@demo.local` },
      update: {},
      create: {
        name: `Participante ${number}`,
        email: `participante${number}@demo.local`,
        passwordHash,
        role: "BIDDER",
      },
    });

    await prisma.wallet.upsert({
      where: { userId: bidder.id },
      update: {},
      create: {
        userId: bidder.id,
        totalCents: 100000n,
        committedCents: 0n,
      },
    });

    bidders.push(bidder);
  }

  const existingLot = await prisma.lot.findFirst({
    where: {
      auctioneerId: auctioneer.id,
      sourceApi: "demo-seed",
      sourceItemId: "demo-lot-001",
    },
  });

  if (!existingLot) {
    const now = new Date();

    await prisma.lot.create({
      data: {
        auctioneerId: auctioneer.id,
        title: "Notebook de Demonstração",
        description: "Lote inicial para testes do sistema de leilões.",
        imageUrl: null,
        sourceApi: "demo-seed",
        sourceItemId: "demo-lot-001",
        itemSnapshot: {
          id: "demo-lot-001",
          title: "Notebook de Demonstração",
          source: "seed-local",
        },
        startingBidCents: 50000n,
        minIncrementCents: 1000n,
        startsAt: new Date(now.getTime() - 60_000),
        endsAt: new Date(now.getTime() + 24 * 60 * 60_000),
        status: "LIVE",
      },
    });
  }

  console.log("Seed concluído.");
  console.log("Leiloeiro:", auctioneer.email);
  console.log("Participantes:", bidders.map((user) => user.email).join(", "));
  console.log("Senha de demonstração: Demo@123456");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });