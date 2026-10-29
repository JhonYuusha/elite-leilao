import "dotenv/config";

import { prisma } from "../src/lib/prisma.js";
import { processExpiredLots } from "../src/services/automatic-settlement.service.js";

const BATCH_SIZE = 25;
const MAX_BATCHES = 10;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL não configurada.");
  }

  let processed = 0;
  let settled = 0;
  let alreadySettled = 0;
  let failed = 0;

  for (let batch = 1; batch <= MAX_BATCHES; batch++) {
    const result = await processExpiredLots(BATCH_SIZE);

    processed += result.processed;
    settled += result.settled;
    alreadySettled += result.alreadySettled;
    failed += result.failed;

    console.log(
      `[automatic-settlement] Lote de processamento ${batch}:`,
      JSON.stringify(result),
    );

    // Se não houver mais registros, encerramos.
    if (result.processed === 0) {
      break;
    }

    // Evita repetir imediatamente um lote que falhou
    // e continua elegível para seleção.
    if (result.failed > 0) {
      console.warn(
        "[automatic-settlement] Falhas detectadas. " +
          "Os lotes pendentes serão reavaliados na próxima execução.",
      );
      break;
    }

    if (result.processed < BATCH_SIZE) {
      break;
    }
  }

  console.log(
    "[automatic-settlement] Resumo:",
    JSON.stringify({
      processed,
      settled,
      alreadySettled,
      failed,
    }),
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(
      "[automatic-settlement] Erro fatal:",
      error,
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });