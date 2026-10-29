import { api } from "../lib/api";
import type {
  PublicReceiptData,
  PublicReceiptResponse,
} from "../types/receipt";

export async function getPublicReceipt(
  token: string,
): Promise<PublicReceiptData> {
  const { data } = await api.get<PublicReceiptResponse>(
    `/receipts/${encodeURIComponent(token)}`,
  );

  return data.receipt;
}
