import axios from "axios";

import { api } from "../lib/api";
import type {
  Lot,
  ManagedLotsResponse,
} from "../types/lot";
import type { ManagementAction } from "../constants/auction";

interface CreatedLotResponse {
  lot: Lot;
}

export async function getManagedLots() {
  const { data } = await api.get<ManagedLotsResponse>(
    "/lots/mine",
  );

  return data.lots;
}

export async function createLot(
  payload: Record<string, unknown>,
): Promise<Lot> {
  const { data } = await api.post<CreatedLotResponse>(
    "/lots",
    payload,
  );

  return data.lot;
}

export async function manageLot(
  lotId: string,
  action: ManagementAction,
): Promise<void> {
  if (action === "cancel") {
    await api.patch(`/lots/${lotId}/cancel`);
    return;
  }

  await api.post(`/lots/${lotId}/settle`);
}

export function apiErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error;

    if (typeof message === "string") {
      return message;
    }
  }

  return fallback;
}