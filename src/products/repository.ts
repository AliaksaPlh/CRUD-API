import type { CreateProductInput, Product } from "./schemas.js";
import {
  MemoryProductStore,
  type ProductRepositoryBackend,
} from "./memory-store.js";

const defaultStore = new MemoryProductStore();

let backend: ProductRepositoryBackend = defaultStore;

export const setProductRepositoryBackend = (
  next: ProductRepositoryBackend,
): void => {
  backend = next;
};

export const resetProductStore = (): void => {
  if (backend !== defaultStore) {
    return;
  }
  defaultStore.clear();
};

export const productRepository = {
  async findAll(): Promise<Array<Product>> {
    return backend.findAll();
  },

  async findById(id: string): Promise<Product | undefined> {
    return backend.findById(id);
  },

  async create(input: CreateProductInput): Promise<Product> {
    return backend.create(input);
  },

  async update(
    id: string,
    input: CreateProductInput,
  ): Promise<Product | undefined> {
    return backend.update(id, input);
  },

  async delete(id: string): Promise<boolean> {
    return backend.delete(id);
  },
};

export { MemoryProductStore };
