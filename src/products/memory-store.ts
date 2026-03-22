import { randomUUID } from "node:crypto";
import type { CreateProductInput, Product } from "./schemas.js";

export type ProductRepositoryBackend = {
  findAll(): Promise<Array<Product>>;
  findById(id: string): Promise<Product | undefined>;
  create(input: CreateProductInput): Promise<Product>;
  update(
    id: string,
    input: CreateProductInput,
  ): Promise<Product | undefined>;
  delete(id: string): Promise<boolean>;
};

export class MemoryProductStore implements ProductRepositoryBackend {
  readonly #productsById = new Map<string, Product>();

  clear(): void {
    this.#productsById.clear();
  }

  async findAll(): Promise<Array<Product>> {
    return Array.from(this.#productsById.values());
  }

  async findById(id: string): Promise<Product | undefined> {
    return this.#productsById.get(id);
  }

  async create(input: CreateProductInput): Promise<Product> {
    const product: Product = {
      id: randomUUID(),
      name: input.name,
      description: input.description,
      price: input.price,
      category: input.category,
      inStock: input.inStock,
    };
    this.#productsById.set(product.id, product);
    return product;
  }

  async update(
    id: string,
    input: CreateProductInput,
  ): Promise<Product | undefined> {
    if (!this.#productsById.has(id)) {
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
    this.#productsById.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.#productsById.delete(id);
  }
}
