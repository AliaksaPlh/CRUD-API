import type { CreateProductInput, Product } from "./schemas.js";
import type { ProductRepositoryBackend } from "./memory-store.js";

const CHANNEL = "db" as const;

type DbRequest =
  | { channel: typeof CHANNEL; id: number; op: "findAll" }
  | { channel: typeof CHANNEL; id: number; op: "findById"; productId: string }
  | {
      channel: typeof CHANNEL;
      id: number;
      op: "create";
      input: CreateProductInput;
    }
  | {
      channel: typeof CHANNEL;
      id: number;
      op: "update";
      productId: string;
      input: CreateProductInput;
    }
  | { channel: typeof CHANNEL; id: number; op: "delete"; productId: string };

type DbResponse =
  | { channel: typeof CHANNEL; id: number; ok: true; result: unknown }
  | { channel: typeof CHANNEL; id: number; ok: false; error: string };

let nextId = 1;
const pending = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (reason: Error) => void }
>();

const handleParentMessage = (msg: unknown): void => {
  if (!msg || typeof msg !== "object") {
    return;
  }
  const m = msg as DbResponse;
  if (m.channel !== CHANNEL || typeof m.id !== "number") {
    return;
  }
  const waiter = pending.get(m.id);
  if (!waiter) {
    return;
  }
  pending.delete(m.id);
  if (m.ok) {
    waiter.resolve(m.result);
    return;
  }
  waiter.reject(new Error(m.error));
};

if (process.send) {
  process.on("message", handleParentMessage);
}

const rpc = (message: DbRequest): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    if (!process.send) {
      reject(new Error("Cluster IPC is not available in this process"));
      return;
    }
    const id = nextId++;
    pending.set(id, { resolve, reject });
    process.send({ ...message, id });
  });
};

export const createClusterIpcBackend = (): ProductRepositoryBackend => ({
  async findAll(): Promise<Array<Product>> {
    const result = await rpc({ channel: CHANNEL, id: 0, op: "findAll" });
    return result as Array<Product>;
  },

  async findById(id: string): Promise<Product | undefined> {
    const result = await rpc({
      channel: CHANNEL,
      id: 0,
      op: "findById",
      productId: id,
    });
    if (result === null) {
      return undefined;
    }
    return result as Product;
  },

  async create(input: CreateProductInput): Promise<Product> {
    const result = await rpc({
      channel: CHANNEL,
      id: 0,
      op: "create",
      input,
    });
    return result as Product;
  },

  async update(
    id: string,
    input: CreateProductInput,
  ): Promise<Product | undefined> {
    const result = await rpc({
      channel: CHANNEL,
      id: 0,
      op: "update",
      productId: id,
      input,
    });
    if (result === null) {
      return undefined;
    }
    return result as Product;
  },

  async delete(id: string): Promise<boolean> {
    const result = await rpc({
      channel: CHANNEL,
      id: 0,
      op: "delete",
      productId: id,
    });
    return result as boolean;
  },
});
