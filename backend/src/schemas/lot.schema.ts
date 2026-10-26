import { z } from "zod";

const MAX_BIGINT = 9223372036854775807n;

const centsSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Informe um inteiro positivo em centavos.")
  .refine(
    (value) => {
      try {
        return BigInt(value) <= MAX_BIGINT;
      } catch {
        return false;
      }
    },
    "Valor monetário fora do limite permitido.",
  );

const commonFields = {
  startingBidCents: centsSchema,
  minIncrementCents: centsSchema,
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
};

const importedLotSchema = z.strictObject({
  ...commonFields,
  sourceItemId: z.number().int().positive().safe(),
  imageUrl: z.url().max(2048).optional(),
});

const manualLotSchema = z.strictObject({
  ...commonFields,
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().max(3000).optional(),
  imageUrl: z.url().max(2048).optional(),
});

export const createLotSchema = z
  .union([importedLotSchema, manualLotSchema])
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