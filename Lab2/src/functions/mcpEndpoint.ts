import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Exchange rates (hardcoded for demo)
// ---------------------------------------------------------------------------
const PLN_TO_EUR = 0.23;
const EUR_TO_PLN = 4.35;

// ---------------------------------------------------------------------------
// MCP Server factory — creates a fresh stateless server per request
// ---------------------------------------------------------------------------
function createCurrencyServer(): McpServer {
  const server = new McpServer({
    name: "currency-converter-mcp",
    version: "1.0.0",
  });

  // Tool 1: PLN → EUR
  server.tool(
    "convert_pln_to_eur",
    "Converts an amount from Polish Zloty (PLN) to Euros (EUR) using a fixed exchange rate.",
    { amount: z.number().describe("The amount in PLN to convert") },
    async ({ amount }) => ({
      content: [
        {
          type: "text" as const,
          text: `${amount} PLN = ${(amount * PLN_TO_EUR).toFixed(2)} EUR (rate: 1 PLN = ${PLN_TO_EUR} EUR)`,
        },
      ],
    })
  );

  // Tool 2: EUR → PLN
  server.tool(
    "convert_eur_to_pln",
    "Converts an amount from Euros (EUR) to Polish Zloty (PLN) using a fixed exchange rate.",
    { amount: z.number().describe("The amount in EUR to convert") },
    async ({ amount }) => ({
      content: [
        {
          type: "text" as const,
          text: `${amount} EUR = ${(amount * EUR_TO_PLN).toFixed(2)} PLN (rate: 1 EUR = ${EUR_TO_PLN} PLN)`,
        },
      ],
    })
  );

  return server;
}

// ---------------------------------------------------------------------------
// MCP HTTP endpoint — uses WebStandardStreamableHTTPServerTransport directly
// Azure Functions v4 HttpRequest is already Web Standard (Fetch API) compatible
// ---------------------------------------------------------------------------
async function mcpHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log("MCP request received:", req.method, req.url);

  try {
    // Parse the body once — we pass it to the transport so it doesn't re-read
    const bodyJson = await req.json();

    // Create a fresh MCP server + transport per request (stateless)
    const server = createCurrencyServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless — no session tracking
    });

    await server.connect(transport);

    // Build a Web Standard Request from Azure Functions HttpRequest
    // We reconstruct with the JSON body since we already consumed req.body
    const webRequest = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: JSON.stringify(bodyJson),
    });

    // handleRequest returns a Web Standard Response
    const webResponse: Response = await transport.handleRequest(webRequest, {
      parsedBody: bodyJson,
    });

    // Convert Web Standard Response → Azure Functions HttpResponseInit
    const responseBody = await webResponse.text();
    const responseHeaders: Record<string, string> = {};
    webResponse.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    context.log("MCP response status:", webResponse.status, "body length:", responseBody.length);

    return {
      status: webResponse.status,
      headers: responseHeaders,
      body: responseBody,
    };
  } catch (err: unknown) {
    context.error("MCP request error:", err);
    return {
      status: 500,
      jsonBody: { error: "Internal server error" },
    };
  }
}

app.http("McpEndpoint", {
  methods: ["POST", "GET", "DELETE"],
  route: "mcp",
  authLevel: "function",
  handler: mcpHandler,
});
