import "dotenv/config";
import { buildApp } from "./app.js";

const portRaw = process.env.PORT?.trim();
if (!portRaw) {
  console.error(
    "PORT is not set. Define PORT in a .env file in the project root (copy .env.example to .env).",
  );
  process.exit(1);
}

const port = Number(portRaw);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(
    "PORT in .env must be an integer between 1 and 65535.",
  );
  process.exit(1);
}

const host = process.env.HOST ?? "0.0.0.0";

const app = buildApp();

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
