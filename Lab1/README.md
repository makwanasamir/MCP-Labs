# Lab 1 — Public Holidays MCP Server

A remote MCP server on **Azure Functions v4 (Node.js 24, Linux)** using the **built-in `app.mcpTool()` API**. Wraps the free [Nager.Date](https://date.nager.at/) API to expose public holiday data as AI-consumable tools.

---

## Tech Stack

| Component | Details |
|-----------|---------|
| **Runtime** | Azure Functions v4, Node.js 24 (Linux) |
| **Language** | TypeScript 5.x |
| **MCP layer** | Built-in `app.mcpTool()` (managed by Azure Functions runtime) |
| **Transport** | Streamable HTTP (managed) |
| **Endpoint** | `/runtime/webhooks/mcp` (auto-generated) |
| **Auth** | `mcp_extension` system key via `x-functions-key` header |
| **External API** | [Nager.Date](https://date.nager.at/api/v3) (free, no auth) |

---

## Tools

| Tool | Input | Output |
|------|-------|--------|
| `get_upcoming_holidays` | `country_code` (ISO 3166-1 alpha-2) | JSON array of upcoming holidays |
| `is_today_holiday` | `country_code` (ISO 3166-1 alpha-2) | Text: yes/no with holiday name |
| `get_holidays_by_year` | `country_code`, `year` (number) | JSON array of all holidays for that year |

Invalid country codes return a clear error message (not a crash).

---

## Architecture

```
MCP Client (Claude / Copilot / Copilot Studio)
    │
    │  POST /runtime/webhooks/mcp  (JSON-RPC over Streamable HTTP)
    ▼
Azure Functions v4 — app.mcpTool() runtime trigger
    ├── get_upcoming_holidays
    ├── is_today_holiday
    └── get_holidays_by_year
          │
          │  HTTP GET
          ▼
    Nager.Date API (https://date.nager.at/api/v3)
```

**Key design:** The `app.mcpTool()` API handles all MCP protocol details (initialization, tool discovery, JSON-RPC routing) automatically. No manual transport wiring needed — just register tools and the runtime does the rest.

---

## Project Structure

```
Lab1/
├── src/
│   ├── index.ts                  # App setup (enableHttpStream)
│   ├── functions/
│   │   ├── holidaysMcpTools.ts   # MCP tool registrations (app.mcpTool)
│   │   └── testHttp.ts           # Health-check HTTP endpoint
│   └── services/
│       └── holidaysService.ts    # Nager.Date API wrapper (axios)
├── host.json                     # Azure Functions host + MCP extension config
├── package.json
├── tsconfig.json
└── .funcignore
```

---

## Setup

```bash
cd Lab1
npm install
npm run build
```

## Run Locally

```bash
func start
# MCP endpoint: http://localhost:7071/runtime/webhooks/mcp
```

---

## API Usage

All requests go to `POST /runtime/webhooks/mcp` with headers:
```
Content-Type: application/json
Accept: application/json, text/event-stream
```

For remote, add: `x-functions-key: <mcp_extension_system_key>`

**Initialize:**
```bash
curl -X POST http://localhost:7071/runtime/webhooks/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

**List tools:**
```bash
curl -X POST http://localhost:7071/runtime/webhooks/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

**Call tool:**
```bash
curl -X POST http://localhost:7071/runtime/webhooks/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_upcoming_holidays","arguments":{"country_code":"PL"}}}'
```

---

## Deploy to Azure

```bash
# Create function app (reusing existing plan & storage)
az functionapp create \
  --name lab1-functionapp-basic \
  --resource-group Vinay_Lab \
  --plan lab1-basic-plan \
  --storage-account mcplabst1770825746 \
  --runtime node --runtime-version 24 \
  --functions-version 4 --os-type Linux

# Configure app settings
az functionapp config appsettings set \
  --name lab1-functionapp-basic \
  --resource-group Vinay_Lab \
  --settings "AzureWebJobsFeatureFlags=EnableWorkerIndexing" \
             "AzureFunctionsJobHost__extensionBundle__downloadPath=%HOME%\data\Functions\ExtensionBundles"

# Deploy (remote build — no node_modules uploaded)
npm run build
func azure functionapp publish lab1-functionapp-basic --build remote

# Get the MCP system key
# Azure Portal → Function App → App keys → System keys → mcp_extension
```

---

## Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

Configure:
- **Transport:** Streamable HTTP
- **URL:** `https://lab1-functionapp-basic.azurewebsites.net/runtime/webhooks/mcp`
- **Header:** `x-functions-key: <mcp_extension_key>`

---

## Client Configuration

### VS Code (GitHub Copilot)

`.vscode/mcp.json`:
```jsonc
{
  "inputs": [
    { "type": "promptString", "id": "mcp-key", "description": "MCP System Key", "password": true }
  ],
  "servers": {
    "lab1-holidays": {
      "type": "http",
      "url": "https://lab1-functionapp-basic.azurewebsites.net/runtime/webhooks/mcp",
      "headers": {
        "x-functions-key": "${input:mcp-key}",
        "Accept": "application/json, text/event-stream"
      }
    }
  }
}
```

### Claude Desktop

`claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "lab1-holidays": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://lab1-functionapp-basic.azurewebsites.net/runtime/webhooks/mcp",
        "--header",
        "x-functions-key:<mcp_extension_key>"
      ]
    }
  }
}
```

### Copilot Studio

**Settings → Tools → Add a tool → MCP Server**
- URL: `https://lab1-functionapp-basic.azurewebsites.net/runtime/webhooks/mcp`
- API Key header: `x-functions-key`
- API Key value: `<mcp_extension_key>`

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `404` on `/runtime/webhooks/mcp` | Ensure `@azure/functions >= 4.9.0` and `enableHttpStream: true` |
| `401 Unauthorized` | Use `mcp_extension` **system key** (not function or master key) |
| Functions missing after deploy | Redeploy with `--build remote` to install deps on server |
| `500 Internal Server Error` | Check `@azure/functions` version, rebuild, redeploy |
| "Failed to fetch" in MCP Inspector | Add origin to CORS settings in Azure Portal |
| VS Code shows 404 | Add `Accept: application/json, text/event-stream` header |
