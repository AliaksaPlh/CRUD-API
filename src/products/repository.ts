import { randomUUID } from "node:crypto";
import type { CreateProductInput, Product } from "./schemas.js";

const productsById = new Map<string, Product>();

export const resetProductStore = (): void => {
  productsById.clear();
};

export const productRepository = {
  async findAll(): Promise<Array<Product>> {
    return Array.from(productsById.values());
  },

  async findById(id: string): Promise<Product | undefined> {
    return productsById.get(id);
  },

  async create(input: CreateProductInput): Promise<Product> {
    const product: Product = {
      id: randomUUID(),
      name: input.name,
      description: input.description,
      price: input.price,
      category: input.category,
      inStock: input.inStock,
    };
    productsById.set(product.id, product);
    return product;
  },

  async update(
    id: string,
    input: CreateProductInput,
  ): Promise<Product | undefined> {
    if (!productsById.has(id)) {
      return undefined;
    }
    const updated: Product = {
      id,
      name: input.name,
      description: input.description,
      price: input.price,
      category: input.category,
      inStock: input.inStock,
    };
    productsById.set(id, updated);
    return updated;
  },

  async delete(id: string): Promise<boolean> {
    return productsById.delete(id);
  },
};
