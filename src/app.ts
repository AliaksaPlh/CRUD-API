import Fastify from "fastify";
import { productsRoutes } from "./products/routes.js";

type BuildAppOptions = {
  logger?: boolean;
};

export const buildApp = (options?: BuildAppOptions) => {
  const app = Fastify({
    logger: options?.logger ?? true,
  });

  void app.register(productsRoutes, { prefix: "/api/products" });

  app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({
      message: `No resource matches ${request.method} ${request.url}. Check the path and try again.`,
    });
  });

  app.setErrorHandler((error, request, reply) => {
    if (reply.sent) {
      return;
    }
    request.log.error(error);

    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof (error as { statusCode: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : undefined;

    if (
      statusCode !== undefined &&
      statusCode >= 400 &&
      statusCode < 500
    ) {
      const message =
        error instanceof Error && error.message.length > 0
          ? error.message
          : "The request could not be processed as sent.";
      return reply.code(statusCode).send({ message });
    }

    return reply.code(500).send({
      message:
        "Something went wrong on the server while handling your request. Please try again later.",
    });
  });

  return app;
};
