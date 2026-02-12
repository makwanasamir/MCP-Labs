import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

app.http("HealthCheck", {
  methods: ["GET"],
  route: "health",
  authLevel: "anonymous",
  handler: async (_req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => ({
    jsonBody: { status: "ok", server: "currency-converter-mcp", version: "1.0.0" },
  }),
});
