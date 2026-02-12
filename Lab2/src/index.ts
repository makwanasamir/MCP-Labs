import { app } from "@azure/functions";

app.setup({ enableHttpStream: true });

// Import function registrations
import "./functions/mcpEndpoint";
import "./functions/healthCheck";
