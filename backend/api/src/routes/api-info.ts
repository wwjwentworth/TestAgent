import type { FastifyPluginAsync } from "fastify";
import { moduleCatalog } from "../modules/catalog.js";

interface ApiInfoResponse {
  name: string;
  modules: readonly string[];
}

export const apiInfoRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: ApiInfoResponse }>("/api", {
    schema: {
      response: {
        200: {
          type: "object",
          required: ["name", "modules"],
          properties: {
            name: { type: "string" },
            modules: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  }, async () => ({ name: "bug-agent-api", modules: moduleCatalog }));
};
