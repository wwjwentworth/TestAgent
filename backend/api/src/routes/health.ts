import type { FastifyPluginAsync } from "fastify";

interface HealthResponse {
  status: "ok";
  service: "api";
}

export const healthRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: HealthResponse }>("/health", {
    schema: {
      response: {
        200: {
          type: "object",
          required: ["status", "service"],
          properties: {
            status: { type: "string", const: "ok" },
            service: { type: "string", const: "api" },
          },
        },
      },
    },
  }, async () => ({ status: "ok", service: "api" }));
};
