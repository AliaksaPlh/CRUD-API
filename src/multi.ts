import "dotenv/config";
import cluster from "node:cluster";
import http from "node:http";
import { availableParallelism, cpus } from "node:os";
import type { Worker } from "node:cluster";
import { MemoryProductStore } from "./products/memory-store.js";
import type { CreateProductInput, Product } from "./products/schemas.js";

const CHANNEL_DB = "db" as const;
const CHANNEL_READY = "worker-ready" as const;

type DbMessage = {
  channel: typeof CHANNEL_DB;
  id: number;
  op: string;
  productId?: string;
  input?: CreateProductInput;
};

const parsePort = (): number => {
  const portRaw = process.env.PORT?.trim();
  if (!portRaw) {
    console.error(
      "PORT is not set. Define PORT in a .env file (copy .env.example to .env).",
    );
    process.exit(1);
  }
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("PORT in .env must be an integer between 1 and 65535.");
    process.exit(1);
  }
  return port;
};

const resolveParallelism = (): number => {
  if (typeof availableParallelism === "function") {
    return availableParallelism();
  }
  return cpus().length;
};

const handleDbMessage = async (
  worker: Worker,
  msg: DbMessage,
  store: MemoryProductStore,
): Promise<void> => {
  const { id } = msg;
  try {
    switch (msg.op) {
      case "findAll": {
        const result: Array<Product> = await store.findAll();
        worker.send({ channel: CHANNEL_DB, id, ok: true, result });
        return;
      }
      case "findById": {
        if (typeof msg.productId !== "string") {
          throw new Error("findById requires productId");
        }
        const product = await store.findById(msg.productId);
        worker.send({
          channel: CHANNEL_DB,
          id,
          ok: true,
          result: product ?? null,
        });
        return;
      }
      case "create": {
        if (!msg.input) {
          throw new Error("create requires input");
        }
        const created = await store.create(msg.input);
        worker.send({ channel: CHANNEL_DB, id, ok: true, result: created });
        return;
      }
      case "update": {
        if (typeof msg.productId !== "string" || !msg.input) {
          throw new Error("update requires productId and input");
        }
        const updated = await store.update(msg.productId, msg.input);
        worker.send({
          channel: CHANNEL_DB,
          id,
          ok: true,
          result: updated ?? null,
        });
        return;
      }
      case "delete": {
        if (typeof msg.productId !== "string") {
          throw new Error("delete requires productId");
        }
        const deleted = await store.delete(msg.productId);
        worker.send({ channel: CHANNEL_DB, id, ok: true, result: deleted });
        return;
      }
      default: {
        worker.send({
          channel: CHANNEL_DB,
          id,
          ok: false,
          error: `Unknown db op: ${msg.op}`,
        });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    worker.send({ channel: CHANNEL_DB, id, ok: false, error: message });
  }
};

const startLoadBalancer = (
  listenPort: number,
  host: string,
  workerPorts: Array<number>,
): http.Server => {
  let rr = 0;
  const server = http.createServer((clientReq, clientRes) => {
    if (!clientReq.url) {
      clientRes.statusCode = 400;
      clientRes.end();
      return;
    }

    if (!clientReq.url.startsWith("/api")) {
      clientRes.statusCode = 404;
      clientRes.setHeader("content-type", "application/json; charset=utf-8");
      clientRes.end(
        JSON.stringify({
          message:
            "No API route on the load balancer. Use paths under /api (e.g. /api/products).",
        }),
      );
      return;
    }

    const targetPort = workerPorts[rr % workerPorts.length]!;
    rr += 1;

    const headers = { ...clientReq.headers, host: `127.0.0.1:${targetPort}` };
    const proxyReq = http.request(
      {
        hostname: "127.0.0.1",
        port: targetPort,
        path: clientReq.url,
        method: clientReq.method,
        headers,
      },
      (proxyRes) => {
        clientRes.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(clientRes);
      },
    );

    proxyReq.on("error", () => {
      if (!clientRes.headersSent) {
        clientRes.statusCode = 502;
        clientRes.setHeader("content-type", "application/json; charset=utf-8");
        clientRes.end(
          JSON.stringify({ message: "Bad gateway: worker unreachable" }),
        );
        return;
      }
      clientRes.destroy();
    });

    clientReq.pipe(proxyReq);
  });

  server.listen(listenPort, host, () => {
    console.log(
      `Load balancer: http://${host === "0.0.0.0" ? "localhost" : host}:${listenPort}/api → round-robin [${workerPorts.join(", ")}]`,
    );
  });

  return server;
};

const startPrimary = async (): Promise<void> => {
  const basePort = parsePort();
  const host = process.env.HOST ?? "0.0.0.0";
  const parallelism = resolveParallelism();
  const workerCount = Math.max(1, parallelism - 1);

  if (basePort + workerCount > 65535) {
    console.error(
      "PORT is too large: need PORT + workerCount free TCP ports (workerCount = max(1, parallelism - 1)).",
    );
    process.exit(1);
  }

  const store = new MemoryProductStore();
  const workerPorts = Array.from(
    { length: workerCount },
    (_, index) => basePort + index + 1,
  );

  let readyWorkers = 0;
  await new Promise<void>((resolveReady) => {
    const tryResolve = (): void => {
      if (readyWorkers >= workerCount) {
        resolveReady();
      }
    };

    for (let index = 0; index < workerCount; index += 1) {
      const workerPort = workerPorts[index]!;
      const worker = cluster.fork({
        CLUSTER_WORKER: "1",
        WORKER_HTTP_PORT: String(workerPort),
      });

      worker.on("message", (raw: unknown) => {
        if (!raw || typeof raw !== "object") {
          return;
        }
        const msg = raw as { channel?: string };
        if (msg.channel === CHANNEL_READY) {
          readyWorkers += 1;
          console.log(`Worker online (HTTP ${workerPort})`);
          tryResolve();
          return;
        }
        if (msg.channel === CHANNEL_DB) {
          void handleDbMessage(worker, raw as DbMessage, store);
        }
      });

      worker.on("exit", (code, signal) => {
        console.error(
          `Worker for port ${workerPort} exited (code=${code}, signal=${signal})`,
        );
      });
    }

    tryResolve();
  });

  startLoadBalancer(basePort, host, workerPorts);
};

const startWorker = async (): Promise<void> => {
  const portRaw = process.env.WORKER_HTTP_PORT?.trim();
  if (!portRaw) {
    console.error("WORKER_HTTP_PORT is not set for cluster worker.");
    process.exit(1);
  }
  const workerPort = Number(portRaw);
  if (!Number.isInteger(workerPort) || workerPort < 1 || workerPort > 65535) {
    console.error("WORKER_HTTP_PORT must be a valid TCP port.");
    process.exit(1);
  }

  const host = process.env.HOST ?? "0.0.0.0";

  const { setProductRepositoryBackend } = await import("./products/repository.js");
  const { createClusterIpcBackend } = await import("./products/ipc-backend.js");
  setProductRepositoryBackend(createClusterIpcBackend());

  const { buildApp } = await import("./app.js");
  const app = buildApp({ logger: true });

  try {
    await app.listen({ port: workerPort, host });
    if (process.send) {
      process.send({ channel: CHANNEL_READY });
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

const run = async (): Promise<void> => {
  if (cluster.isPrimary) {
    await startPrimary();
    return;
  }
  await startWorker();
};

await run();
