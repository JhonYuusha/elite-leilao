import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não configurada.");
}

if (process.env.CONFIRM_DEMO_SETUP !== "YES") {
  throw new Error("Confirme a execução com CONFIRM_DEMO_SETUP=YES.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  }),
});

const accounts = [
  {
    name: "Leiloeiro Demo",
    email: "leiloeiro@demo.local",
    role: "AUCTIONEER" as const,
  },
  {
    name: "Participante 1",
    email: "participante1@demo.local",
    role: "BIDDER" as const,
  },
  {
    name: "Participante 2",
    email: "participante2@demo.local",
    role: "BIDDER" as const,
  },
];

async function main() {
  const results: Array<{
    email: string;
    password: string | null;
    status: string;
  }> = [];

  for (const account of accounts) {
    const existing = await prisma.user.findUnique({
      where: { email: account.email },
      select: { id: true, role: true },
    });

    if (existing) {
      if (existing.role !== account.role) {
        throw new Error(`Perfil inesperado para ${account.email}`);
      }

      results.push({
        email: account.email,
        password: null,
        status: "Já existia; senha preservada",
      });

      continue;
    }

    const password = randomBytes(18).toString("base64url");
    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: account.name,
          email: account.email,
          passwordHash,
          role: account.role,
        },
      });

      if (account.role === "BIDDER") {
        await tx.wallet.create({
          data: {
            userId: user.id,
            totalCents: 100000n,
            committedCents: 0n,
          },
        });
      }
    });

    results.push({
      email: account.email,
      password,
      status: "Criada",
    });
  }

  console.log("\nCONTAS DE DEMONSTRAÇÃO\n");

  for (const result of results) {
    console.log(`E-mail: ${result.email}`);
    console.log(`Status: ${result.status}`);

    if (result.password) {
      console.log(`Senha: ${result.password}`);
    }

    console.log("");
  }

  console.log("Guarde as senhas em local privado.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
