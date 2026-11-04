import { processExpiredLots } from "./automatic-settlement.service.js";

const DEFAULT_INTERVAL_MS = 15_000;
const BATCH_SIZE = 25;
const MAX_BATCHES = 10;

export function startSettlementScheduler() {
  const configuredInterval = Number(
    process.env.SETTLEMENT_INTERVAL_MS ?? DEFAULT_INTERVAL_MS,
  );

  const intervalMs =
    Number.isSafeInteger(configuredInterval) &&
    configuredInterval >= 1_000
      ? configuredInterval
      : DEFAULT_INTERVAL_MS;

  let stopped = false;
  let activeRun: Promise<void> | undefined;

  async function processBatches() {
    try {
      for (let batch = 0; batch < MAX_BATCHES; batch++) {
        if (stopped) break;

        const result = await processExpiredLots(BATCH_SIZE);

        if (result.processed > 0) {
          console.log(
            "[settlement-scheduler]",
            JSON.stringify(result),
          );
        }

        if (
          result.processed < BATCH_SIZE ||
          result.failed > 0
        ) {
          break;
        }
      }
    } catch (error) {
      console.error(
        "[settlement-scheduler] Erro:",
        error,
      );
    }
  }

  function run() {
    if (stopped || activeRun) return;

    const task = processBatches();
    activeRun = task;

    void task.finally(() => {
      if (activeRun === task) {
        activeRun = undefined;
      }
    });
  }

  const timer = setInterval(run, intervalMs);

  run();

  console.log(
    `[settlement-scheduler] Iniciado: ${intervalMs}ms`,
  );

  return async function stopSettlementScheduler() {
    stopped = true;
    clearInterval(timer);

    if (activeRun) {
      await activeRun;
    }
  };
}