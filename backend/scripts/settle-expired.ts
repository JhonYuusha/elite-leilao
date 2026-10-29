import "dotenv/config";

import { prisma } from "../src/lib/prisma.js";
import { processExpiredLots } from "../src/services/automatic-settlement.service.js";

async function main() {
  const result = await processExpiredLots();

  console.log(
    "[automatic-settlement] Resultado:",
    JSON.stringify(result),
  );

  if (result.failed > 0) {
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
