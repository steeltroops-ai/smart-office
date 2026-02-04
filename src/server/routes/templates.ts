// Template Routes - Smart Office POC
// Aligned with docs/03-architecture-blueprint.md

import { Hono } from "hono";
import { storage } from "../services/storage";
import { wrapResponse, wrapError } from "../utils/response";

export const templateRoutes = new Hono();

// List all templates
templateRoutes.get("/", async (c) => {
  try {
    const templates = await storage.listTemplates();
    // Return summary without full content
    const summary = templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
    }));
    return c.json(wrapResponse(summary));
  } catch (error) {
    console.error("Error listing templates:", error);
    return c.json(wrapError("LIST_ERROR", "Failed to list templates"), 500);
  }
});

// Get single template with content
templateRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const template = await storage.getTemplate(id);
    if (!template) {
      return c.json(
        wrapError("TEMPLATE_NOT_FOUND", `Template ${id} not found`),
        404,
      );
    }
    return c.json(wrapResponse(template));
  } catch (error) {
    console.error("Error getting template:", error);
    return c.json(wrapError("GET_ERROR", "Failed to get template"), 500);
  }
});
