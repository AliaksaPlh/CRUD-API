# CRUD API — Product Catalog (go to dev branch)

Simple CRUD API for a product catalog built with Fastify and in-memory storage.
https://github.com/AlreadyBored/nodejs-assignments/blob/main/assignments-v2/03-crud-api/assignment.md

## Features

- Fastify-based REST API
- Full CRUD for products
- Request validation with Zod
- Human-friendly `404` and `500` handlers
- Environment configuration via `.env`
- Development and production modes
- Optional multi-process mode (`start:multi`) with:
  - Node.js Cluster workers
  - Round-robin load balancer
  - Shared in-memory state via IPC
- API tests with `node:test` + `fastify.inject()`

## Tech Stack

- Node.js `>=24.10.0`
- TypeScript
- Fastify
- Zod
- Dotenv

## Project Structure

```text
src/
  app.ts                     # Fastify app + global handlers
  server.ts                  # Single-instance server bootstrap
  cluster.ts                 # Optional cluster mode + load balancer
  routes/
    products.ts              # CRUD routes
    products.test.ts         # API tests
  schemas/
    product.ts               # Zod schemas
  services/
    product-store.ts         # In-memory store + IPC-backed store
  types/
    product.ts               # Product types
```

## Prerequisites

1. Install Node.js `24.10.0` or newer.
2. Ensure `npm` is available.

Check versions:

```bash
node -v
npm -v
```

## Installation

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from example:

```bash
cp .env.example .env
```

3. `.env` should contain:

```env
PORT=4000
```

## Available Scripts

- `npm run start:dev` — run app in development mode (`tsx watch`)
- `npm run build` — compile TypeScript to `dist/`
- `npm run start:prod` — build and run compiled server
- `npm run start:multi` — build and run cluster mode (load balancer + workers)
- `npm test` — run API tests

## Run the Application

### Development mode

```bash
npm run start:dev
```

Server starts on:

`http://localhost:4000`

### Production mode

```bash
npm run start:prod
```

### Optional: Multi mode (cluster + load balancer)

```bash
npm run start:multi
```

Expected behavior:

- Load balancer listens on `PORT` (default: `4000`)
- Workers listen on `PORT + 1 ... PORT + n`
- `n = availableParallelism() - 1` (at least 1 worker)
- Requests to `localhost:4000` are forwarded round-robin to workers

## API Reference

Base URL:

`http://localhost:4000/api/products`

### Product model

```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "price": 99.99,
  "category": "electronics | books | clothing | ...",
  "inStock": true
}
```

### Endpoints

#### 1) Get all products

- `GET /api/products`
- `200` → array of products

```bash
curl -i http://localhost:4000/api/products
```

#### 2) Get product by id

- `GET /api/products/:productId`
- `200` → product object
- `400` → invalid UUID
- `404` → product not found

```bash
curl -i http://localhost:4000/api/products/<PRODUCT_ID>
```

#### 3) Create product

- `POST /api/products`
- `201` → created product
- `400` → invalid/missing required fields

```bash
curl -i -X POST http://localhost:4000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Phone",
    "description": "Smartphone",
    "price": 999.99,
    "category": "electronics",
    "inStock": true
  }'
```

#### 4) Update product

- `PUT /api/products/:productId`
- `200` → updated product
- `400` → invalid UUID or invalid body
- `404` → product not found

```bash
curl -i -X PUT http://localhost:4000/api/products/<PRODUCT_ID> \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Phone Pro",
    "description": "Updated model",
    "price": 1099.99,
    "category": "electronics",
    "inStock": false
  }'
```

#### 5) Delete product

- `DELETE /api/products/:productId`
- `204` → deleted
- `400` → invalid UUID
- `404` → product not found

```bash
curl -i -X DELETE http://localhost:4000/api/products/<PRODUCT_ID>
```

### Non-existing routes

For unknown routes, server returns:

- `404`
- human-friendly message

Example:

```bash
curl -i http://localhost:4000/some-non/existing/resource
```

## Error Handling

- Route-level validation and domain errors return `400`/`404`
- Global Fastify error handler returns `500`
- Not found handler returns `404` for unknown endpoints

## Testing

Run tests:

```bash
npm test
```

Current tests cover:

1. Full E2E scenario in one test:
   - `GET empty` → `POST` → `GET by id` → `PUT` → `DELETE` → `GET deleted (404)`
2. Invalid UUID scenario (`GET`/`PUT`/`DELETE` -> `400`)
3. Validation + not found (`POST invalid body -> 400`, `GET unknown UUID -> 404`)

## Multi Mode Consistency Check (manual)

Start cluster:

```bash
npm run start:multi
```

Then verify cross-worker state:

1. `POST` to `http://localhost:4001/api/products`
2. `GET` same ID from `http://localhost:4002/api/products/:id` → expect `200`
3. `DELETE` same ID on `http://localhost:4003/api/products/:id` → expect `204`
4. `GET` same ID again on `http://localhost:4001/api/products/:id` → expect `404`

## Notes

- Data is in-memory and resets after process restart.
- `.env` is excluded from git; use `.env.example` as template.
