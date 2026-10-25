import { z } from "zod";

const MAX_BIGINT = 9223372036854775807n;

export const depositSchema = z
  .object({
    amountCents: z
      .string()
      .regex(
        /^[1-9]\d*$/,
        "Informe um valor inteiro positivo em centavos.",
      )
      .refine(
        (value) => {
          try {
            return BigInt(value) <= MAX_BIGINT;
          } catch {
            return false;
          }
        },
        "Valor acima do limite permitido ou inválido.",
      ),
  })
  .strict();

export type DepositInput = z.infer<typeof depositSchema>;