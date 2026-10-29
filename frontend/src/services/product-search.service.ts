import { z } from "zod";

const productSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  description: z.string(),
  thumbnail: z.string().url(),
  category: z.string(),
});

const searchResponseSchema = z.object({
  products: z.array(productSchema),
  total: z.number(),
});

export type ExternalProduct = z.infer<typeof productSchema>;

export async function searchExternalProducts(
  search: string,
  signal?: AbortSignal,
): Promise<ExternalProduct[]> {
  const query = search.trim();

  if (!query) return [];

  const url = new URL("https://dummyjson.com/products/search");

  url.searchParams.set("q", query);
  url.searchParams.set("limit", "12");

  const response = await fetch(url.toString(), {
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Não foi possível pesquisar os produtos.");
  }

  const parsed = searchResponseSchema.safeParse(
    await response.json(),
  );

  if (!parsed.success) {
    throw new Error("O catálogo externo retornou dados inválidos.");
  }

  return parsed.data.products;
}
