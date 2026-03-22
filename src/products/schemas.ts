import { z } from "zod";

export const productIdParamSchema = z.object({
  productId: z.string().uuid(),
});

export const createProductBodySchema = z
  .object({
    name: z.string().min(1),
    description: z.string(),
    price: z.number().finite().positive(),
    category: z.string().min(1),
    inStock: z.boolean(),
  })
  .strict();

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  inStock: boolean;
};

export type CreateProductInput = z.infer<typeof createProductBodySchema>;
