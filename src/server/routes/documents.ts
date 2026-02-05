// Document Routes - Smart Office POC
// Aligned with docs/03-architecture-blueprint.md

import { Hono } from "hono";
import { storage } from "../services/storage";
import { generateId } from "../utils/id";
import { wrapResponse, wrapError } from "../utils/response";

export const documentRoutes = new Hono();

// List all documents (summary only, no content)
documentRoutes.get("/", async (c) => {
  try {
    const docs = await storage.listDocuments();
    const summary = docs.map((d) => ({
      id: d.id,
      title: d.title,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
    return c.json(wrapResponse(summary));
  } catch (error) {
    console.error("Error listing documents:", error);
    return c.json(wrapError("LIST_ERROR", "Failed to list documents"), 500);
  }
});

// Get single document with full content
documentRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const doc = await storage.getDocument(id);
    if (!doc) {
      return c.json(
        wrapError("DOCUMENT_NOT_FOUND", `Document ${id} not found`),
        404,
      );
    }
    return c.json(wrapResponse(doc));
  } catch (error) {
    console.error("Error getting document:", error);
    return c.json(wrapError("GET_ERROR", "Failed to get document"), 500);
  }
});

// Validate TipTap content structure
function isValidContent(content: any): boolean {
  if (!content || typeof content !== "object") return false;
  if (content.type !== "doc") return false;
  if (content.content !== undefined && !Array.isArray(content.content))
    return false;
  return true;
}

// Create new document
documentRoutes.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const now = new Date().toISOString();

    // Validate title
    const rawTitle = (body.title || "").toString();
    if (rawTitle.length > 255) {
      return c.json(
        wrapError("VALIDATION_ERROR", "Title cannot exceed 255 characters"),
        400,
      );
    }
    const title = rawTitle.trim() || "Untitled Document";

    // Default empty content
    let content: object = { type: "doc", content: [{ type: "paragraph" }] };

    // If template specified, load its content
    if (body.templateId) {
      const template = await storage.getTemplate(body.templateId);
      if (template && template.content) {
        content = template.content;
      }
    }

    // Use provided content if valid, otherwise use default/template
    if (body.content) {
      if (!isValidContent(body.content)) {
        return c.json(
          wrapError(
            "VALIDATION_ERROR",
            "Invalid content structure. Must be a valid TipTap document.",
          ),
          400,
        );
      }
      content = body.content;
    }

    const doc = {
      id: generateId("doc"),
      title,
      content,
      templateId: body.templateId || null,
      settings: body.settings || null,
      createdAt: now,
      updatedAt: now,
    };

    await storage.saveDocument(doc);
    return c.json(wrapResponse(doc), 201);
  } catch (error) {
    console.error("Error creating document:", error);
    return c.json(wrapError("CREATE_ERROR", "Failed to create document"), 500);
  }
});

// Update existing document
documentRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const body = await c.req.json();
    const existing = await storage.getDocument(id);

    if (!existing) {
      return c.json(
        wrapError("DOCUMENT_NOT_FOUND", `Document ${id} not found`),
        404,
      );
    }

    // Validate title if provided
    let title = existing.title;
    if (body.title !== undefined) {
      const rawTitle = (body.title || "").toString();
      if (rawTitle.length > 255) {
        return c.json(
          wrapError("VALIDATION_ERROR", "Title cannot exceed 255 characters"),
          400,
        );
      }
      title = rawTitle.trim() || "Untitled Document";
    }

    // Validate content if provided
    let content = existing.content;
    if (body.content !== undefined) {
      if (!isValidContent(body.content)) {
        return c.json(
          wrapError(
            "VALIDATION_ERROR",
            "Invalid content structure. Must be a valid TipTap document.",
          ),
          400,
        );
      }
      content = body.content;
    }

    const updated = {
      ...existing,
      title,
      content,
      settings: body.settings ?? existing.settings ?? null,
      updatedAt: new Date().toISOString(),
    };

    await storage.saveDocument(updated);
    return c.json(wrapResponse(updated));
  } catch (error) {
    console.error("Error updating document:", error);
    return c.json(wrapError("UPDATE_ERROR", "Failed to update document"), 500);
  }
});

// Delete document
documentRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const deleted = await storage.deleteDocument(id);

    if (!deleted) {
      return c.json(
        wrapError("DOCUMENT_NOT_FOUND", `Document ${id} not found`),
        404,
      );
    }

    return c.json(wrapResponse({ deleted: true }));
  } catch (error) {
    console.error("Error deleting document:", error);
    return c.json(wrapError("DELETE_ERROR", "Failed to delete document"), 500);
  }
});
