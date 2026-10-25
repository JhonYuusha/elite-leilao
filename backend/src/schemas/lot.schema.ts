import { z } from "zod";

const centsSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Informe um inteiro positivo em centavos.")
  .refine(
    (value) => {
      try {
        return BigInt(value) <= 9_223_372_036_854_775_807n;
      } catch {
        return false;
      }
    },
    "Valor monetário fora do limite permitido.",
  );

export const createLotSchema = z
  .object({
    sourceItemId: z.number().int().positive().safe(),
    startingBidCents: centsSchema,
    minIncrementCents: centsSchema,
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (Date.parse(data.endsAt) <= Date.parse(data.startsAt)) {
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "O encerramento deve ser posterior ao início.",
      });
    }
  });

export type CreateLotInput = z.infer<typeof createLotSchema>;