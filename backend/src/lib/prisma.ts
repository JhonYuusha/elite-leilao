import "dotenv/config";

import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não configurada.");
}

const isExternalSettlement =
  process.env.EXTERNAL_SETTLEMENT === "true";

const adapter = new PrismaPg({
  connectionString,
  ...(isExternalSettlement
    ? {
        ssl: {
          rejectUnauthorized: false,
        },
      }
    : {}),
});

export const prisma = new PrismaClient({
  adapter,
});