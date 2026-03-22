import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { buildApp } from "../src/app.js";
import type { Product } from "../src/products/schemas.js";
import { resetProductStore } from "../src/products/repository.js";
import type { FastifyInstance } from "fastify";

const sampleProduct = {
  name: "Test keyboard",
  description: "Mechanical switches",
  price: 129.99,
  category: "electronics",
  inStock: true,
} as const;

const parseJson = <T>(raw: string): T => JSON.parse(raw) as T;

describe("Product API", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    resetProductStore();
    app = buildApp({ logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("assignment scenario: full product lifecycle (6 sequential steps)", async () => {
    // 1) Get all records with GET /api/products (empty array expected)
    const listEmpty = await app.inject({
      method: "GET",
      url: "/api/products",
    });
    assert.equal(listEmpty.statusCode, 200);
    assert.deepEqual(parseJson<Array<unknown>>(listEmpty.body), []);

    // 2) POST /api/products — response must contain the newly created record
    const createdRes = await app.inject({
      method: "POST",
      url: "/api/products",
      headers: { "content-type": "application/json" },
      payload: sampleProduct,
    });
    assert.equal(createdRes.statusCode, 201);
    const created = parseJson<Product>(createdRes.body);
    assert.ok(created.id);
    assert.equal(created.name, sampleProduct.name);
    assert.equal(created.description, sampleProduct.description);
    assert.equal(created.price, sampleProduct.price);
    assert.equal(created.category, sampleProduct.category);
    assert.equal(created.inStock, sampleProduct.inStock);

    // 3) GET /api/products/{productId} — the created record is expected
    const getOne = await app.inject({
      method: "GET",
      url: `/api/products/${created.id}`,
    });
    assert.equal(getOne.statusCode, 200);
    assert.deepEqual(parseJson<Product>(getOne.body), created);

    // 4) PUT /api/products/{productId} — same id, full updated object
    const updatePayload = {
      name: "Updated keyboard",
      description: "New switches",
      price: 149.99,
      category: "electronics",
      inStock: false,
    };
    const updatedRes = await app.inject({
      method: "PUT",
      url: `/api/products/${created.id}`,
      headers: { "content-type": "application/json" },
      payload: updatePayload,
    });
    assert.equal(updatedRes.statusCode, 200);
    const updated = parseJson<Product>(updatedRes.body);
    assert.equal(updated.id, created.id);
    assert.equal(updated.name, updatePayload.name);
    assert.equal(updated.description, updatePayload.description);
    assert.equal(updated.price, updatePayload.price);
    assert.equal(updated.category, updatePayload.category);
    assert.equal(updated.inStock, updatePayload.inStock);

    // 5) DELETE /api/products/{productId} — confirmation of successful deletion (204, no body)
    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/products/${created.id}`,
    });
    assert.equal(deleted.statusCode, 204);
    assert.equal(deleted.body, "");

    // 6) GET deleted id — there is no such object (404 + message)
    const gone = await app.inject({
      method: "GET",
      url: `/api/products/${created.id}`,
    });
    assert.equal(gone.statusCode, 404);
    const goneBody = parseJson<{ message: string }>(gone.body);
    assert.ok(typeof goneBody.message === "string");
    assert.match(goneBody.message, /not found/i);
  });

  it("scenario: GET /api/products/:id with invalid id returns 400", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/products/not-a-uuid",
    });
    assert.equal(res.statusCode, 400);
    assert.ok(parseJson<{ message: string }>(res.body).message.length > 0);
  });

  it("scenario: POST /api/products with invalid body returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/products",
      headers: { "content-type": "application/json" },
      payload: { name: "Only name" },
    });
    assert.equal(res.statusCode, 400);
    assert.ok(parseJson<{ message: string }>(res.body).message.length > 0);
  });
});
