# Lab 2 — Currency Converter MCP Server

A remote MCP server on **Azure Functions v4 (Node.js 24)** using the **official MCP TypeScript SDK** with `WebStandardStreamableHTTPServerTransport`. Exposes PLN ↔ EUR currency conversion as AI-consumable tools.

---

## Tech Stack

| Component | Details |
|-----------|---------|
| **Runtime** | Azure Functions v4, Node.js 24 (Linux) |
| **Language** | TypeScript 5.x |
| **MCP SDK** | `@modelcontextprotocol/sdk` ^1.12.1 |
| **Transport** | `WebStandardStreamableHTTPServerTransport` |
| **Protocol** | MCP `2025-03-26` / JSON-RPC 2.0 over Streamable HTTP |
| **Auth** | Function-level key (`x-functions-key` header) |
| **State** | Stateless — fresh `McpServer` + transport per request |

---

## How it differs from Lab 1

| | Lab 1 | Lab 2 |
|-|-------|-------|
| **MCP layer** | Built-in `app.mcpTool()` | Official `@modelcontextprotocol/sdk` |
| **Transport** | Managed by runtime | Manual `WebStandardStreamableHTTPServerTransport` |
| **Endpoint** | `/runtime/webhooks/mcp` | `/api/mcp` (custom HTTP trigger) |
| **Auth** | MCP webhook key | Standard function key |

---

## Tools

| Tool | Input | Output |
|------|-------|--------|
| `convert_pln_to_eur` | `amount` (number) | `"100 PLN = 23.00 EUR (rate: 1 PLN = 0.23 EUR)"` |
| `convert_eur_to_pln` | `amount` (number) | `"50 EUR = 217.50 PLN (rate: 1 EUR = 4.35 PLN)"` |

Exchange rates: **1 PLN = 0.23 EUR** / **1 EUR = 4.35 PLN** (hardcoded).

---

## Architecture

```
MCP Client (Claude / Copilot / Copilot Studio)
    │
    │  POST /api/mcp  (JSON-RPC over Streamable HTTP)
    ▼
Azure Functions v4 HTTP Trigger
    │
    ▼
WebStandardStreamableHTTPServerTransport  ← Web Standard Request (Fetch API)
    │
    ▼
McpServer (SDK)
  ├── convert_pln_to_eur
  └── convert_eur_to_pln
    │
    ▼
Web Standard Response → Azure HttpResponseInit
```

**Key design:** Azure Functions v4 `HttpRequest` is undici-based (Web Standard Fetch API), so it maps directly to the SDK's Web Standard transport — no Node.js stream adapters needed.

---

## Project Structure

```
Lab2/
├── src/
│   ├── index.ts                    # Entry point — app.setup({ enableHttpStream: true })
│   └── functions/
│       ├── mcpEndpoint.ts          # MCP HTTP trigger + SDK wiring
│       └── healthCheck.ts          # GET /api/health
├── tests/
│   └── mcp.integration.test.ts     # 18 integration tests (vitest)
├── dist/                           # Compiled JS (git-ignored)
├── host.json                       # Azure Functions host config
├── local.settings.json             # Local dev settings (git-ignored)
├── package.json
├── tsconfig.json
└── .funcignore
```

---

## Setup

```bash
cd Lab2
npm install
npm run build
```

## Run Locally

```bash
func start
# Server starts at http://localhost:7071
```

## Run Tests

```bash
# Start func in one terminal, then in another:
npx vitest run
```

---

## API Usage

All requests go to `POST /api/mcp` with headers:
```
Content-Type: application/json
Accept: application/json, text/event-stream
```

**Initialize:**
```bash
curl -X POST http://localhost:7071/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
```

**List tools:**
```bash
curl -X POST http://localhost:7071/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

**Call tool:**
```bash
curl -X POST http://localhost:7071/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"convert_pln_to_eur","arguments":{"amount":100}}}'
```

---

## Deploy to Azure

```bash
# Create function app
az functionapp create \
  --name lab2-functionapp-currency \
  --resource-group <YOUR_RG> \
  --plan <YOUR_PLAN> \
  --storage-account <YOUR_STORAGE> \
  --runtime node --runtime-version 24 \
  --functions-version 4 --os-type Linux

# Configure
az functionapp config appsettings set \
  --name lab2-functionapp-currency \
  --resource-group <YOUR_RG> \
  --settings "AzureWebJobsFeatureFlags=EnableWorkerIndexing" \
             "WEBSITE_RUN_FROM_PACKAGE=0"

# Deploy
func azure functionapp publish lab2-functionapp-currency --nozip

# Get key
az functionapp keys list \
  --name lab2-functionapp-currency \
  --resource-group <YOUR_RG> \
  --query "masterKey" -o tsv
```

For remote requests, add `x-functions-key: <YOUR_KEY>` header or `?code=<YOUR_KEY>` query param.

---

## Client Configuration

### VS Code (GitHub Copilot)

`.vscode/mcp.json`:
```json
{
  "servers": {
    "lab2-currency-converter": {
      "type": "http",
      "url": "https://lab2-functionapp-currency.azurewebsites.net/api/mcp",
      "headers": { "x-functions-key": "<YOUR_KEY>" }
    }
  }
}
```

### Claude Desktop

`claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "lab2-currency-converter": {
      "type": "streamableHttp",
      "url": "https://lab2-functionapp-currency.azurewebsites.net/api/mcp",
      "headers": { "x-functions-key": "<YOUR_KEY>" }
    }
  }
}
```

### Copilot Studio

**Settings → Tools → Add a tool → MCP Server**
- URL: `https://lab2-functionapp-currency.azurewebsites.net/api/mcp`
- API Key header: `x-functions-key`
- API Key value: `<YOUR_KEY>`

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `406 Not Acceptable` | Add `Accept: application/json, text/event-stream` header |
| `401 Unauthorized` | Include `x-functions-key` header with valid key |
| Functions missing after deploy | `az functionapp restart --name lab2-functionapp-currency --resource-group <RG>` |
| Build errors | `npm install && npm run build` — requires TypeScript ≥ 5.0 |
| `Unable to find project root` | `cd Lab2/` before running `func start` |
