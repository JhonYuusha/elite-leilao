import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    lot: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../services/settlement.service.js", () => ({
  settleLot: vi.fn(),
  SettlementError: class SettlementError extends Error {
    constructor(
      public readonly statusCode: number,
      message: string,
    ) {
      super(message);
    }
  },
}));

import { prisma } from "../lib/prisma.js";
import { settleLot } from "../services/settlement.service.js";
import { processExpiredLots } from "../services/automatic-settlement.service.js";

const findManyMock = vi.mocked(prisma.lot.findMany);
const settleLotMock = vi.mocked(settleLot);

describe("Liquidação automática", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("não liquida quando não há lotes vencidos", async () => {
    findManyMock.mockResolvedValue([]);

    const result = await processExpiredLots();

    expect(result).toEqual({
      processed: 0,
      settled: 0,
      alreadySettled: 0,
      failed: 0,
    });

    expect(settleLotMock).not.toHaveBeenCalled();
  });

  it("liquida os lotes selecionados", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "lote-1",
        auctioneerId: "leiloeiro-1",
      },
      {
        id: "lote-2",
        auctioneerId: "leiloeiro-2",
      },
    ] as never);

    settleLotMock.mockResolvedValue({
      settlement: {} as never,
      alreadySettled: false,
    });

    const result = await processExpiredLots();

    expect(result.processed).toBe(2);
    expect(result.settled).toBe(2);

    expect(settleLotMock).toHaveBeenCalledWith(
      "lote-1",
      "leiloeiro-1",
    );

    expect(settleLotMock).toHaveBeenCalledWith(
      "lote-2",
      "leiloeiro-2",
    );
  });

  it("continua após falha em um lote", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "lote-1",
        auctioneerId: "leiloeiro-1",
      },
      {
        id: "lote-2",
        auctioneerId: "leiloeiro-2",
      },
    ] as never);

    settleLotMock
      .mockRejectedValueOnce(new Error("Falha simulada"))
      .mockResolvedValueOnce({
        settlement: {} as never,
        alreadySettled: false,
      });

    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const result = await processExpiredLots();

      expect(result).toEqual({
        processed: 2,
        settled: 1,
        alreadySettled: 0,
        failed: 1,
      });
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
