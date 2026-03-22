import type { FastifyPluginAsync } from "fastify";
import { createProductBodySchema, productIdParamSchema } from "./schemas.js";
import { productRepository } from "./repository.js";

const invalidIdMessage = { message: "Product ID is not a valid UUID" };
const notFoundMessage = { message: "Product not found" };
const invalidBodyMessage = {
  message:
    "Request body must contain required fields: name, description, price (> 0), category, inStock (boolean)",
};

export const productsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async () => {
    return productRepository.findAll();
  });

  fastify.get("/:productId", async (request, reply) => {
    const paramsResult = productIdParamSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return reply.code(400).send(invalidIdMessage);
    }
    const { productId } = paramsResult.data;
    const product = await productRepository.findById(productId);
    if (!product) {
      return reply.code(404).send(notFoundMessage);
    }
    return product;
  });

  fastify.post("/", async (request, reply) => {
    const bodyResult = createProductBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.code(400).send(invalidBodyMessage);
    }
    const created = await productRepository.create(bodyResult.data);
    return reply.code(201).send(created);
  });

  fastify.put("/:productId", async (request, reply) => {
    const paramsResult = productIdParamSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return reply.code(400).send(invalidIdMessage);
    }
    const bodyResult = createProductBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.code(400).send(invalidBodyMessage);
    }
    const { productId } = paramsResult.data;
    const updated = await productRepository.update(productId, bodyResult.data);
    if (!updated) {
      return reply.code(404).send(notFoundMessage);
    }
    return updated;
  });

  fastify.delete("/:productId", async (request, reply) => {
    const paramsResult = productIdParamSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return reply.code(400).send(invalidIdMessage);
    }
    const { productId } = paramsResult.data;
    const deleted = await productRepository.delete(productId);
    if (!deleted) {
      return reply.code(404).send(notFoundMessage);
    }
    return reply.code(204).send();
  });
};
