import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { processExpiredLots } from "../services/automatic-settlement.service.js";
import { startSettlementScheduler } from "../services/settlement-scheduler.js";

vi.mock("../services/automatic-settlement.service.js", () => ({
  processExpiredLots: vi.fn(),
}));

const mockedProcess = vi.mocked(processExpiredLots);

const emptyResult = {
  processed: 0,
  settled: 0,
  alreadySettled: 0,
  failed: 0,
};

describe("Agendador de liquidação automática", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    delete process.env.SETTLEMENT_INTERVAL_MS;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.SETTLEMENT_INTERVAL_MS;
  });

  it("executa imediatamente ao iniciar", async () => {
    mockedProcess.mockResolvedValue(emptyResult);

    const stop = startSettlementScheduler();

    await vi.waitFor(() => {
      expect(mockedProcess).toHaveBeenCalledTimes(1);
    });

    await stop();
  });

  it("executa novamente após o intervalo", async () => {
    mockedProcess.mockResolvedValue(emptyResult);

    const stop = startSettlementScheduler();

    await vi.advanceTimersByTimeAsync(15_000);

    expect(mockedProcess).toHaveBeenCalledTimes(2);

    await stop();
  });

  it("não sobrepõe ciclos em andamento", async () => {
    let release!: (value: typeof emptyResult) => void;

    mockedProcess.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );

    mockedProcess.mockResolvedValue(emptyResult);

    const stop = startSettlementScheduler();

    expect(mockedProcess).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(45_000);

    expect(mockedProcess).toHaveBeenCalledTimes(1);

    release(emptyResult);
    await stop();
  });

  it("aguarda a execução ativa antes de encerrar", async () => {
    let release!: (value: typeof emptyResult) => void;

    mockedProcess.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );

    const stop = startSettlementScheduler();

    let finished = false;

    const stopping = stop().then(() => {
      finished = true;
    });

    await Promise.resolve();

    expect(finished).toBe(false);

    release(emptyResult);
    await stopping;

    expect(finished).toBe(true);

    await vi.advanceTimersByTimeAsync(30_000);

    expect(mockedProcess).toHaveBeenCalledTimes(1);
  });
});