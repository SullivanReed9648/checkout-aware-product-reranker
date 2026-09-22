import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { rerankCheckoutSearch } from "./commerce_search.js";
import { createInfraiReranker, InfraiError } from "./infrai_reranker.js";
import { searchRequestSchema } from "./search_contract.js";

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/checkout/search") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const input = searchRequestSchema.parse(await readJson(request));
    const result = await rerankCheckoutSearch(input, createInfraiReranker());
    send(response, 200, result);
  } catch (error) {
    if (error instanceof ZodError) {
      send(response, 400, { error: "Invalid request body", issues: error.issues });
      return;
    }
    if (error instanceof SyntaxError) {
      send(response, 400, { error: "Request body must be JSON" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.message, code: error.code });
      return;
    }
    send(response, 500, { error: error instanceof Error ? error.message : "Unexpected error" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`Checkout search listening on http://localhost:${port}`);
});
