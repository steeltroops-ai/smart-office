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

// Create new document
documentRoutes.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const now = new Date().toISOString();

    // Default empty content
    let content = { type: "doc", content: [{ type: "paragraph" }] };

    // If template specified, load its content
    if (body.templateId) {
      const template = await storage.getTemplate(body.templateId);
      if (template) {
        content = template.content;
      }
    }

    const doc = {
      id: generateId("doc"),
      title: body.title || "Untitled Document",
      content: body.content || content,
      templateId: body.templateId || null,
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

    const updated = {
      ...existing,
      title: body.title ?? existing.title,
      content: body.content ?? existing.content,
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
    await storage.deleteDocument(id);
    return c.json(wrapResponse({ deleted: true }));
  } catch (error) {
    console.error("Error deleting document:", error);
    return c.json(wrapError("DELETE_ERROR", "Failed to delete document"), 500);
  }
});
