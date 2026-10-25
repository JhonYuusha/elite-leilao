
import { z } from "zod";

const MAX_BIGINT = 9223372036854775807n;

export const createBidSchema = z
  .object({
    amountCents: z
      .string()
      .regex(
        /^[1-9]\d*$/,
        "O lance deve ser um inteiro positivo em centavos.",
      )
      .refine((value) => {
        try {
          return BigInt(value) <= MAX_BIGINT;
        } catch {
          return false;
        }
      }, "Valor do lance inválido ou acima do limite."),
  })
  .strict();

export type CreateBidInput = z.infer<typeof createBidSchema>;