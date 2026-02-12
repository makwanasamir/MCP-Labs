# 🌍 Public Holidays MCP Server

> A remote [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server built with **Azure Functions v4** (Node.js / TypeScript) that exposes public-holiday data as AI-consumable tools.

[![Azure Functions](https://img.shields.io/badge/Azure%20Functions-v4-blue?logo=azure-functions)](https://learn.microsoft.com/azure/azure-functions/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-2024--11--05-purple)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Table of Contents

- [Overview](#overview)
- [Tools](#tools)
- [API Details](#api-details)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Deploying to Azure](#deploying-to-azure)
- [Testing with MCP Inspector](#testing-with-mcp-inspector)
- [Connecting Clients](#connecting-clients)
- [Troubleshooting](#troubleshooting)
- [Azure Plan Recommendations](#azure-plan-recommendations)
- [Security Best Practices](#security-best-practices)
- [Quick Reference](#quick-reference)
- [License](#license)

---

## Overview

This project implements an MCP server on Azure Functions that wraps the free [Nager.Date](https://date.nager.at/) API. Any MCP-compatible client — Claude Desktop, GitHub Copilot in VS Code, Copilot Studio, or MCP Inspector — can discover and invoke the tools over HTTP.

> **Server Description (used by AI orchestrators):**
> *"A server that provides public holiday information for countries worldwide. Use this server when a user asks about public holidays, bank holidays, national holidays, or days off in any country."*

## Tools

| Tool | Description | Parameters | Output |
|------|-------------|------------|--------|
| `get_upcoming_holidays` | Get the next upcoming public holidays for a country. Returns name, date, and whether it is fixed or variable. | `country_code` (string, required) — ISO 3166-1 alpha-2 | JSON array of holiday objects (`date`, `localName`, `name`, `countryCode`, `fixed`, `global`, `types`) |
| `is_today_holiday` | Check if today is a public holiday in a given country. | `country_code` (string, required) — ISO 3166-1 alpha-2 | Text: *"Yes, today is [name] in [country]"* or *"No, today is not a public holiday in [country]"* |
| `get_holidays_by_year` | Get all public holidays for a specific year and country. | `country_code` (string, required), `year` (number, required) | JSON array of all holiday objects for that year |

> **Error handling:** If an invalid country code is provided (e.g., `XX`), the server returns a clear error message: *"Invalid country code. Please use ISO 3166-1 alpha-2 format (e.g., PL for Poland)."*

## API Details

| Item | Details |
|------|---------|
| **API Name** | [Nager.Date — Public Holiday API](https://date.nager.at/) |
| **Base URL** | `https://date.nager.at/api/v3` |
| **Authentication** | None required (free, open API) |
| **Endpoint 1** | `GET /NextPublicHolidays/{countryCode}` — Returns the next upcoming public holidays |
| **Endpoint 2** | `GET /IsTodayPublicHoliday/{countryCode}` — Returns 200 if today is a holiday, 204 if not |
| **Endpoint 3** | `GET /PublicHolidays/{year}/{countryCode}` — Returns all holidays for a given year |
| **Country code format** | ISO 3166-1 alpha-2 (e.g., `PL` for Poland, `DE` for Germany, `US` for United States) |
| **Rate limits** | None documented; keep requests reasonable |

## Architecture

```
┌──────────────────┐       JSON-RPC / HTTP        ┌──────────────────────────┐
│  MCP Client      │ ──────────────────────────── │  Azure Functions v4      │
│  (Claude, Copilot│       POST /runtime/         │  ┌────────────────────┐  │
│   VS Code, etc.) │       webhooks/mcp           │  │ mcpToolTrigger     │  │
└──────────────────┘                              │  │  ├ get_upcoming_   │  │
                                                  │  │  ├ is_today_       │  │
                                                  │  │  └ get_holidays_   │  │
                                                  │  └────────┬───────────┘  │
                                                  │           │              │
                                                  │  ┌────────▼───────────┐  │
                                                  │  │  Nager.Date API    │  │
                                                  │  └────────────────────┘  │
                                                  └──────────────────────────┘
```

### Technology Stack

| Component | Choice |
|-----------|--------|
| Language | TypeScript |
| Runtime | Node.js 20+ |
| MCP Host | Azure Functions v4 (`@azure/functions >= 4.9.0`) |
| Transport | Streamable HTTP |
| Deployment | `func azure functionapp publish --build remote` or `azd up` |
| Hosting Plan | Consumption (demo) / Flex Consumption or Premium (production) |

---

## Prerequisites

| Requirement | Version | Install |
|-------------|---------|---------|
| **Node.js** | 18 + | [nodejs.org](https://nodejs.org/) |
| **Azure Functions Core Tools** | 4.x (`>= 4.0.7030`) | [Install guide](https://learn.microsoft.com/azure/azure-functions/functions-run-local) |
| **Azure CLI** | Latest | [Install guide](https://learn.microsoft.com/cli/azure/install-azure-cli) |
| **Git** | Latest | [git-scm.com](https://git-scm.com/) |

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/makwanasamir/MCP-Labs.git
cd Lab1
```

### 2. Install dependencies

```bash
npm install
```

### 3. Build

```bash
npm run build
```

### 4. Run locally

```bash
func start
```

> The MCP endpoint will be available at `http://localhost:7071/runtime/webhooks/mcp`

### 5. Verify (curl)

```bash
# Initialize
curl -s -X POST http://localhost:7071/runtime/webhooks/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

# List tools
curl -s -X POST http://localhost:7071/runtime/webhooks/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# Call a tool
curl -s -X POST http://localhost:7071/runtime/webhooks/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_upcoming_holidays","arguments":{"country_code":"US"}}}'
```

---

## Deploying to Azure

### 1. Create Azure resources

```bash
# Create resource group
az group create --name <resource-group> --location <location>

# Create storage account
az storage account create \
  --name <storage-name> \
  --resource-group <resource-group> \
  --location <location> \
  --sku Standard_LRS

# Create function app (Node.js runtime)
az functionapp create \
  --resource-group <resource-group> \
  --name <function-app-name> \
  --storage-account <storage-name> \
  --runtime node \
  --runtime-version 20 \
  --functions-version 4 \
  --consumption-plan-location <location>
```

### 2. Deploy (recommended: remote build)

```bash
npm run build
func azure functionapp publish <function-app-name> --build remote
```

> **Why `--build remote`?** The `.funcignore` excludes `node_modules` to keep the upload small (~20 KB). Azure runs `npm install` on the server, ensuring platform-correct binaries.

### 3. Obtain the MCP system key

1. Open **Azure Portal** → navigate to your Function App
2. Go to **App keys** (under the Functions section in left menu)
3. Under **System keys**, copy the value of `mcp_extension`

> This key is required by all clients to authenticate with the MCP endpoint.

### 4. Verify deployment

```bash
curl -s -X POST "https://<function-app-name>.azurewebsites.net/runtime/webhooks/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "x-functions-key: <mcp_extension_key>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

---

## Testing with MCP Inspector

Before connecting production clients, verify your server with **MCP Inspector** — the official testing tool for MCP servers.

```bash
npx @modelcontextprotocol/inspector
```

Open `http://localhost:5173`, then configure:

| Setting | Value |
|---------|-------|
| Transport | **Streamable HTTP** |
| Connection | **Direct** |
| URL | `https://<function-app-name>.azurewebsites.net/runtime/webhooks/mcp` |
| Header `x-functions-key` | `<mcp_extension_key>` |

**Test steps:**
1. Click **Connect** — you should see a successful initialization response.
2. Click **List Tools** — all three tools (`get_upcoming_holidays`, `is_today_holiday`, `get_holidays_by_year`) should appear.
3. Select `get_upcoming_holidays`, enter `PL` as the country code, and click **Run** — verify real Polish holiday data is returned.
4. Test `is_today_holiday` with `PL` — verify you get a clear yes/no response.
5. Test `get_holidays_by_year` with year `2026` and country `PL` — verify the full year of holidays is returned.
6. Test with an invalid country code (`XX`) — verify you get a helpful error message, not a crash.

> **Note:** Enable CORS (`*` or `http://localhost:5173`) on the Function App in Azure Portal → **CORS** settings if you get "failed to fetch" errors.

Once all tools return expected data in MCP Inspector, proceed to connect your clients below.

---

## Connecting Clients

### Claude Desktop

Claude Desktop uses **stdio** transport. Use [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) as a bridge.

Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "public-holidays": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://<function-app-name>.azurewebsites.net/runtime/webhooks/mcp",
        "--header",
        "x-functions-key:<mcp_extension_key>"
      ]
    }
  }
}
```

Restart Claude Desktop. The tools appear under the 🔨 icon in the chat input.

---

### VS Code / GitHub Copilot

Add to `.vscode/mcp.json` in your workspace:

```jsonc
{
  "inputs": [
    {
      "type": "promptString",
      "id": "mcp-key",
      "description": "Azure Functions MCP Extension System Key",
      "password": true
    }
  ],
  "servers": {
    "public-holidays": {
      "type": "http",
      "url": "https://<function-app-name>.azurewebsites.net/runtime/webhooks/mcp",
      "headers": {
        "x-functions-key": "${input:mcp-key}",
        "Accept": "application/json, text/event-stream"
      }
    }
  }
}
```

Start the server: `Ctrl+Shift+P` → **MCP: List Servers** → ▶️ Start → enter your key when prompted.

---

### Copilot Studio

1. Open the agent in Copilot Studio → go to **Tools** → **Add a Tool** → **New Tool** → **Model Context Protocol**.
2. Fill in:
   - **Server name**: `Public Holidays`
   - **Server description**: `Provides public holiday information for countries worldwide. Use when asked about public holidays, bank holidays, or national holidays.`
   - **URL**: `https://<function-app-name>.azurewebsites.net/runtime/webhooks/mcp`
   - **Authentication**: API Key
   - **Header name**: `x-functions-key`
   - **Key value**: your `mcp_extension` system key
3. Click **Create**, then add all discovered tools to the agent.
4. Test by typing: *"What are the next public holidays in Poland?"*
5. Verify the agent calls the `get_upcoming_holidays` tool and returns real Polish holiday data.
6. Check the **Activity map** to confirm which MCP tool was invoked.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| **Functions not listed** after deploy | `node_modules` missing and no remote build | Redeploy with `--build remote` |
| **404** on `/runtime/webhooks/mcp` | Functions not registered or wrong package version | Ensure `@azure/functions >= 4.9.0` in `package.json` |
| **401 Unauthorized** | Missing or wrong key | Use `mcp_extension` system key (not function key) |
| **500 Internal Server Error** | Outdated `@azure/functions` package | Update to `^4.9.0`, rebuild, redeploy |
| **"Failed to fetch"** in MCP Inspector | CORS not configured | Add origin to Function App CORS settings in Azure Portal |
| **VS Code shows 404** | Missing `Accept` header | Add `"Accept": "application/json, text/event-stream"` to headers |
| **Claude config error** | Used `url` instead of `command` | Claude needs stdio; use `mcp-remote` bridge (see above) |

### Useful commands

```bash
# Check deployed functions
func azure functionapp list-functions <function-app-name>

# Stream live logs
func azure functionapp logstream <function-app-name>

# View app settings
az functionapp config appsettings list \
  --name <function-app-name> \
  --resource-group <resource-group>

# List function keys
az functionapp keys list \
  --name <function-app-name> \
  --resource-group <resource-group>
```

---

## Azure Plan Recommendations

| Plan | Best For | Considerations |
|------|----------|----------------|
| **Consumption** (default) | Dev / test, low traffic | Cold starts (~2-5 s); pay-per-execution |
| **Flex Consumption** | Variable production workloads | Reduced cold starts; per-second billing |
| **Premium (EP1+)** | Production with consistent traffic | No cold starts; VNET integration |
| **App Service (B1+)** | Predictable costs | Always-on; fixed monthly cost |

> **Tip:** For MCP servers used by AI assistants, cold starts can cause timeouts. Consider **Premium** or an always-on **App Service** plan for production.

---

## Security Best Practices

- **Never commit secrets.** `local.settings.json` is excluded via `.gitignore` and `.funcignore`.
- **Use `mcp_extension` system key** — not the master key — for client authentication.
- **Rotate keys** periodically via Azure Portal or CLI.
- **Enable HTTPS only** (default on Azure Functions).
- **Restrict CORS** to specific origins in production (avoid `*`).
- For enterprise: front with **API Management** or enable **App Service authentication (EasyAuth)** for OAuth / Entra ID.

---

## Quick Reference

```bash
# Install
npm install

# Build
npm run build

# Run locally
func start

# Deploy
func azure functionapp publish <function-app-name> --build remote

# Test (remote)
curl -s -X POST "https://<function-app-name>.azurewebsites.net/runtime/webhooks/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "x-functions-key: <mcp_extension_key>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

---

## Project Structure

```
Lab1/
├── src/
│   ├── index.ts                  # App setup (enableHttpStream)
│   ├── functions/
│   │   ├── holidaysMcpTools.ts   # MCP tool registrations (app.mcpTool)
│   │   └── testHttp.ts           # Health-check HTTP endpoint
│   ├── services/
│   │   └── holidaysService.ts    # Nager.Date API wrapper (axios → Nager.Date)
│   └── tools/
│       └── holidaysTools.ts      # Tool definitions & handler logic
├── host.json                     # Azure Functions host + MCP extension config
├── package.json                  # Dependencies & scripts
├── tsconfig.json                 # TypeScript configuration
├── azd.yaml                      # Azure Developer CLI config
├── .funcignore                   # Files excluded from deployment
├── .gitignore                    # Files excluded from git
└── README.md                     # This file
```

---

## License

MIT
