import { z } from "zod";

const productSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string(),
  category: z.string(),
  thumbnail: z.string().url(),
});

export type ImportedProduct = z.infer<typeof productSchema>;

export class ExternalProductServiceError extends Error {
  constructor() {
    super("Falha ao consultar o catálogo externo.");
    this.name = "ExternalProductServiceError";
  }
}

export async function getExternalProduct(
  productId: number,
): Promise<ImportedProduct | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(
      `https://dummyjson.com/products/${productId}`,
      { signal: controller.signal },
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new ExternalProductServiceError();
    }

    const parsed = productSchema.safeParse(
      await response.json(),
    );

    if (!parsed.success) {
      throw new ExternalProductServiceError();
    }

    return parsed.data;
  } catch (error) {
    if (error instanceof ExternalProductServiceError) {
      throw error;
    }

    throw new ExternalProductServiceError();
  } finally {
    clearTimeout(timeout);
  }
}