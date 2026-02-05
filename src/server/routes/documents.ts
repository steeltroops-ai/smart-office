// Document Routes - Smart Office Enterprise V1
// Implements SQLite storage, Locking, and Basic Auth

import { Hono } from "hono";
import { storage } from "../services/storage";
import { generateId } from "../utils/id";
import { wrapResponse, wrapError } from "../utils/response";

export const documentRoutes = new Hono();

// Helper to get user ID
function getUserId(c: any): string {
  const uid = c.req.header("X-User-ID");
  return uid || "anonymous";
}

// List all documents (summary)
documentRoutes.get("/", async (c) => {
  try {
    const docs = await storage.listDocuments();
    return c.json(wrapResponse(docs));
  } catch (error) {
    console.error("Error listing documents:", error);
    return c.json(wrapError("LIST_ERROR", "Failed to list documents"), 500);
  }
});

// Get single document
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

// Validate TipTap content
function isValidContent(content: any): boolean {
  if (!content || typeof content !== "object") return false;
  if (content.type !== "doc") return false;
  if (content.content !== undefined && !Array.isArray(content.content))
    return false;
  return true;
}

// Create document
documentRoutes.post("/", async (c) => {
  const userId = getUserId(c);
  try {
    const body = await c.req.json();
    const now = new Date().toISOString();

    const rawTitle = (body.title || "").toString();
    const title = rawTitle.trim().substring(0, 255) || "Untitled Document";

    let content: object = { type: "doc", content: [{ type: "paragraph" }] };

    if (body.templateId) {
      const template = await storage.getTemplate(body.templateId);
      if (template && template.content) {
        content = template.content;
      }
    } else if (body.content && isValidContent(body.content)) {
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
      lockedBy: userId, // Auto-lock for creator
      lockedAt: now,
    };

    await storage.saveDocument(doc);
    return c.json(wrapResponse(doc), 201);
  } catch (error) {
    console.error("Error creating document:", error);
    return c.json(wrapError("CREATE_ERROR", "Failed to create document"), 500);
  }
});

// Update document (with Locking)
documentRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = getUserId(c);

  try {
    const body = await c.req.json();
    const existing = await storage.getDocument(id);

    if (!existing) {
      return c.json(wrapError("NOT_FOUND", "Document not found"), 404);
    }

    // Attempt to acquire/refresh lock
    const hasLock = await storage.lockDocument(id, userId);
    if (!hasLock) {
      // Locked by someone else
      return c.json(
        wrapError("LOCKED", `Document is locked by ${existing.lockedBy}`),
        409, // Conflict
      );
    }

    const updated = {
      ...existing,
      title: body.title || existing.title,
      content: body.content || existing.content,
      settings: body.settings ?? existing.settings,
      updatedAt: new Date().toISOString(),
      lockedBy: userId, // Maintain lock
      lockedAt: new Date().toISOString(),
    };

    await storage.saveDocument(updated);
    return c.json(wrapResponse(updated));
  } catch (error) {
    console.error("Error updating document:", error);
    return c.json(wrapError("UPDATE_ERROR", "Failed to update document"), 500);
  }
});

// Heartbeat (Maintain Lock)
documentRoutes.post("/:id/heartbeat", async (c) => {
  const id = c.req.param("id");
  const userId = getUserId(c);

  try {
    const success = await storage.heartbeat(id, userId);
    return c.json({ locked: success });
  } catch (error) {
    return c.json({ locked: false });
  }
});

// Delete document
documentRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = getUserId(c);

  try {
    const doc = await storage.getDocument(id);
    if (!doc) return c.json(wrapError("NOT_FOUND", "Document not found"), 404);

    // Check lock before delete?
    // Enterprise rule: Only owner or if unlocked?
    // For V1 POC: Allow delete if unlocked or locked by me.
    if (doc.lockedBy && doc.lockedBy !== userId) {
      // Check if lock expired? storage.lockDocument handles expiry logic but getting it is raw.
      // We'll trust the explicit check here.
      // If needed, we could force-break lock, but V1 says no.
      return c.json(wrapError("LOCKED", "Cannot delete locked document"), 409);
    }

    const deleted = await storage.deleteDocument(id);
    return c.json(wrapResponse({ deleted }));
  } catch (error) {
    console.error("Error deleting document:", error);
    return c.json(wrapError("DELETE_ERROR", "Failed to delete document"), 500);
  }
});
