import { z } from "zod";
import { operations } from "@/lib/central/operations";

type JsonSchema = Record<string, unknown> & {
  properties?: Record<string, JsonSchema>;
  required?: string[];
  anyOf?: JsonSchema[];
  type?: string;
  description?: string;
};

// GPT Actions handles plain types better than unions, so collapse the input-side unions Zod emits.
function simplify(schema: JsonSchema): JsonSchema {
  const { anyOf, properties, ...rest } = schema;
  if (anyOf) {
    const types = new Set(anyOf.map((branch) => branch.type));
    const type = types.has("boolean") ? "boolean" : types.size === 1 ? [...types][0] : "string";
    const description = rest.description ?? anyOf.find((branch) => branch.description)?.description;
    return { ...rest, type, ...(description && { description }) };
  }
  if (properties) {
    return {
      ...rest,
      properties: Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, simplify(value)])),
    };
  }
  if (rest.items && typeof rest.items === "object") return { ...rest, items: simplify(rest.items as JsonSchema) };
  return rest;
}

function toJsonSchema(schema: z.ZodType): JsonSchema {
  const { $schema: _ignored, ...json } = z.toJSONSchema(schema, { io: "input", target: "draft-2020-12" }) as JsonSchema;
  return simplify(json);
}

// GPT Actions rejects operation descriptions longer than 300 characters.
function shortDescription(text: string, max = 300) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(".") + 1) || cut;
}

export function buildOpenApi(appUrl: string) {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const operation of operations) {
    const json = toJsonSchema(operation.schema);
    const properties = json.properties ?? {};
    const required = new Set(json.required ?? []);
    const pathParams: string[] = operation.http.pathParams ?? [];

    const parameters: Record<string, unknown>[] = pathParams.map((name) => ({
      name,
      in: "path",
      required: true,
      description: properties[name]?.description,
      schema: { type: "string" },
    }));

    let requestBody: Record<string, unknown> | undefined;
    if (operation.http.method === "GET") {
      for (const [name, schema] of Object.entries(properties)) {
        if (pathParams.includes(name)) continue;
        const { description, ...rest } = schema;
        parameters.push({ name, in: "query", required: required.has(name), description, schema: rest });
      }
    } else {
      const bodyProperties = Object.fromEntries(
        Object.entries(properties).filter(([name]) => !pathParams.includes(name)),
      );
      const bodyRequired = [...required].filter((name) => !pathParams.includes(name));
      requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: bodyProperties,
              ...(bodyRequired.length > 0 && { required: bodyRequired }),
            },
          },
        },
      };
    }

    paths[operation.http.path] ??= {};
    paths[operation.http.path][operation.http.method.toLowerCase()] = {
      operationId: operation.operationId,
      summary: operation.title,
      description: shortDescription(operation.description),
      ...(parameters.length > 0 && { parameters }),
      ...(requestBody && { requestBody }),
      ...(!operation.readOnly && { "x-openai-isConsequential": false }),
      responses: {
        "200": {
          description: "Sucesso",
          content: { "application/json": { schema: { type: "object", additionalProperties: true } } },
        },
        "400": { $ref: "#/components/responses/Error" },
        "401": { $ref: "#/components/responses/Error" },
        "404": { $ref: "#/components/responses/Error" },
      },
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Central 3C",
      version: "1.0.0",
      description: "Memória compartilhada de projetos, trabalho e estudos entre Claude e ChatGPT.",
    },
    servers: [{ url: `${appUrl}/api/v1` }],
    security: [{ bearerAuth: [] }],
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
      schemas: {},
      responses: {
        Error: {
          description: "Erro",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: {
                    type: "object",
                    properties: { code: { type: "string" }, message: { type: "string" } },
                    required: ["code", "message"],
                  },
                },
                required: ["error"],
              },
            },
          },
        },
      },
    },
  };
}
