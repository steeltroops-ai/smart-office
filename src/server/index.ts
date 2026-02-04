// Server Entry Point - Smart Office POC
// Aligned with docs/03-architecture-blueprint.md

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { documentRoutes } from "./routes/documents";
import { templateRoutes } from "./routes/templates";

const app = new Hono();

// Middleware
app.use("*", cors());

// Health check endpoint
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// API Routes
app.route("/api/documents", documentRoutes);
app.route("/api/templates", templateRoutes);

// Serve static files from client directory
app.use("/*", serveStatic({ root: "./src/client" }));

// Get port from environment or default to 3000
const port = process.env.PORT || 3000;

console.log(`
╔════════════════════════════════════════════════════════════╗
║            Smart Office - Document Editor POC              ║
╠════════════════════════════════════════════════════════════╣
║  Server running at:                                        ║
║    Local:   http://localhost:${port}                          ║
║    Network: http://${getLocalIP()}:${port}                      ║
╠════════════════════════════════════════════════════════════╣
║  API Endpoints:                                            ║
║    GET  /api/health     - Health check                     ║
║    GET  /api/documents  - List documents                   ║
║    POST /api/documents  - Create document                  ║
║    GET  /api/templates  - List templates                   ║
╚════════════════════════════════════════════════════════════╝
`);

// Helper to get local IP for LAN access
function getLocalIP(): string {
  try {
    const os = require("os");
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }
  } catch {
    // Ignore errors
  }
  return "0.0.0.0";
}

// Export for Bun
export default {
  port,
  fetch: app.fetch,
};
