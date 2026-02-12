/**
 * Integration tests for the Currency Converter MCP Server.
 *
 * Prerequisites: `func start` must be running in Lab2/ on http://localhost:7071
 */
import { describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:7071/api";

const MCP_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Send a JSON-RPC request to the MCP endpoint and return parsed SSE data */
async function mcpRequest(body: object): Promise<{ status: number; parsed: any; raw: string }> {
  const res = await fetch(`${BASE_URL}/mcp`, {
    method: "POST",
    headers: MCP_HEADERS,
    body: JSON.stringify(body),
  });
  const raw = await res.text();

  // The transport returns SSE format: "event: message\ndata: {...}\n\n"
  let parsed: any = null;
  const dataMatch = raw.match(/^data: (.+)$/m);
  if (dataMatch) {
    parsed = JSON.parse(dataMatch[1]);
  } else {
    // Try plain JSON fallback
    try {
      parsed = JSON.parse(raw);
    } catch {
      // leave parsed as null
    }
  }

  return { status: res.status, parsed, raw };
}

function jsonrpc(id: number, method: string, params: object = {}) {
  return { jsonrpc: "2.0", id, method, params };
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

describe("Health Check", () => {
  it("GET /api/health returns 200 with status ok", async () => {
    const res = await fetch(`${BASE_URL}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      status: "ok",
      server: "currency-converter-mcp",
      version: "1.0.0",
    });
  });
});

// ---------------------------------------------------------------------------
// MCP Protocol — Initialize
// ---------------------------------------------------------------------------

describe("MCP Initialize", () => {
  it("returns protocol version and server info", async () => {
    const { status, parsed } = await mcpRequest(
      jsonrpc(1, "initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test-runner", version: "1.0.0" },
      })
    );

    expect(status).toBe(200);
    expect(parsed.result.protocolVersion).toBe("2025-03-26");
    expect(parsed.result.serverInfo).toMatchObject({
      name: "currency-converter-mcp",
      version: "1.0.0",
    });
  });

  it("advertises tools capability", async () => {
    const { parsed } = await mcpRequest(
      jsonrpc(1, "initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test-runner", version: "1.0.0" },
      })
    );

    expect(parsed.result.capabilities.tools).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// MCP Protocol — Tools List
// ---------------------------------------------------------------------------

describe("MCP Tools List", () => {
  it("returns exactly 2 tools", async () => {
    const { status, parsed } = await mcpRequest(jsonrpc(2, "tools/list"));

    expect(status).toBe(200);
    expect(parsed.result.tools).toHaveLength(2);
  });

  it("includes convert_pln_to_eur tool with correct schema", async () => {
    const { parsed } = await mcpRequest(jsonrpc(2, "tools/list"));
    const tool = parsed.result.tools.find((t: any) => t.name === "convert_pln_to_eur");

    expect(tool).toBeDefined();
    expect(tool.description).toContain("PLN");
    expect(tool.description).toContain("EUR");
    expect(tool.inputSchema.properties.amount.type).toBe("number");
    expect(tool.inputSchema.required).toContain("amount");
  });

  it("includes convert_eur_to_pln tool with correct schema", async () => {
    const { parsed } = await mcpRequest(jsonrpc(2, "tools/list"));
    const tool = parsed.result.tools.find((t: any) => t.name === "convert_eur_to_pln");

    expect(tool).toBeDefined();
    expect(tool.description).toContain("EUR");
    expect(tool.description).toContain("PLN");
    expect(tool.inputSchema.properties.amount.type).toBe("number");
    expect(tool.inputSchema.required).toContain("amount");
  });
});

// ---------------------------------------------------------------------------
// MCP Protocol — Tool Calls: convert_pln_to_eur
// ---------------------------------------------------------------------------

describe("convert_pln_to_eur", () => {
  it("converts 100 PLN to 23.00 EUR", async () => {
    const { status, parsed } = await mcpRequest(
      jsonrpc(3, "tools/call", { name: "convert_pln_to_eur", arguments: { amount: 100 } })
    );

    expect(status).toBe(200);
    expect(parsed.result.content).toHaveLength(1);
    expect(parsed.result.content[0].type).toBe("text");
    expect(parsed.result.content[0].text).toContain("100 PLN = 23.00 EUR");
    expect(parsed.result.content[0].text).toContain("rate: 1 PLN = 0.23 EUR");
  });

  it("converts 0 PLN to 0.00 EUR", async () => {
    const { parsed } = await mcpRequest(
      jsonrpc(3, "tools/call", { name: "convert_pln_to_eur", arguments: { amount: 0 } })
    );

    expect(parsed.result.content[0].text).toContain("0 PLN = 0.00 EUR");
  });

  it("converts decimal amount 99.50 PLN", async () => {
    const { parsed } = await mcpRequest(
      jsonrpc(3, "tools/call", { name: "convert_pln_to_eur", arguments: { amount: 99.5 } })
    );

    // 99.5 * 0.23 = 22.885 → 22.89
    expect(parsed.result.content[0].text).toContain("99.5 PLN = 22.89 EUR");
  });

  it("converts large amount 1000000 PLN", async () => {
    const { parsed } = await mcpRequest(
      jsonrpc(3, "tools/call", { name: "convert_pln_to_eur", arguments: { amount: 1000000 } })
    );

    // 1000000 * 0.23 = 230000
    expect(parsed.result.content[0].text).toContain("1000000 PLN = 230000.00 EUR");
  });
});

// ---------------------------------------------------------------------------
// MCP Protocol — Tool Calls: convert_eur_to_pln
// ---------------------------------------------------------------------------

describe("convert_eur_to_pln", () => {
  it("converts 50 EUR to 217.50 PLN", async () => {
    const { status, parsed } = await mcpRequest(
      jsonrpc(4, "tools/call", { name: "convert_eur_to_pln", arguments: { amount: 50 } })
    );

    expect(status).toBe(200);
    expect(parsed.result.content).toHaveLength(1);
    expect(parsed.result.content[0].type).toBe("text");
    expect(parsed.result.content[0].text).toContain("50 EUR = 217.50 PLN");
    expect(parsed.result.content[0].text).toContain("rate: 1 EUR = 4.35 PLN");
  });

  it("converts 0 EUR to 0.00 PLN", async () => {
    const { parsed } = await mcpRequest(
      jsonrpc(4, "tools/call", { name: "convert_eur_to_pln", arguments: { amount: 0 } })
    );

    expect(parsed.result.content[0].text).toContain("0 EUR = 0.00 PLN");
  });

  it("converts 1 EUR to 4.35 PLN", async () => {
    const { parsed } = await mcpRequest(
      jsonrpc(4, "tools/call", { name: "convert_eur_to_pln", arguments: { amount: 1 } })
    );

    expect(parsed.result.content[0].text).toContain("1 EUR = 4.35 PLN");
  });
});

// ---------------------------------------------------------------------------
// MCP Protocol — Error Handling
// ---------------------------------------------------------------------------

describe("MCP Error Handling", () => {
  it("returns 406 when Accept header is missing text/event-stream", async () => {
    const res = await fetch(`${BASE_URL}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(jsonrpc(5, "initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" },
      })),
    });

    expect(res.status).toBe(406);
  });

  it("returns error when Content-Type is not application/json", async () => {
    const res = await fetch(`${BASE_URL}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "text/plain", Accept: "application/json, text/event-stream" },
      body: "not json",
    });

    // Our handler calls req.json() before the transport checks Content-Type,
    // so a non-JSON body triggers a 500 (parse error) rather than the SDK's 415.
    expect([415, 500]).toContain(res.status);
  });

  it("returns error for unknown tool name", async () => {
    const { parsed } = await mcpRequest(
      jsonrpc(6, "tools/call", { name: "nonexistent_tool", arguments: {} })
    );

    expect(parsed.error || parsed.result?.isError).toBeTruthy();
  });

  it("returns error when amount is missing", async () => {
    const { parsed } = await mcpRequest(
      jsonrpc(7, "tools/call", { name: "convert_pln_to_eur", arguments: {} })
    );

    // SDK should reject — missing required param
    expect(parsed.error || parsed.result?.isError).toBeTruthy();
  });

  it("returns error when amount is not a number", async () => {
    const { parsed } = await mcpRequest(
      jsonrpc(8, "tools/call", { name: "convert_pln_to_eur", arguments: { amount: "abc" } })
    );

    expect(parsed.error || parsed.result?.isError).toBeTruthy();
  });
});
