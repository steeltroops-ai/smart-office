// Storage Service - Smart Office POC
// File-based JSON storage for documents and templates
// Aligned with docs/03-architecture-blueprint.md

import { readdir, readFile, writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const DOCUMENTS_DIR = "./data/documents";
const TEMPLATES_DIR = "./templates";

interface DocumentSettings {
  pageSize?: "a4" | "letter" | "legal" | "a5";
  lineSpacing?: number;
}

interface Document {
  id: string;
  title: string;
  content: object;
  templateId?: string | null;
  settings?: DocumentSettings | null;
  createdAt: string;
  updatedAt: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  content: object;
}

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

export const storage = {
  // ============ Documents ============

  async listDocuments(): Promise<Document[]> {
    await ensureDir(DOCUMENTS_DIR);

    try {
      const files = await readdir(DOCUMENTS_DIR);
      const docs = await Promise.all(
        files
          .filter((f) => f.endsWith(".json"))
          .map(async (f) => {
            const data = await readFile(join(DOCUMENTS_DIR, f), "utf-8");
            return JSON.parse(data) as Document;
          }),
      );
      // Sort by updatedAt descending (newest first)
      return docs.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    } catch {
      return [];
    }
  },

  async getDocument(id: string): Promise<Document | null> {
    try {
      const data = await readFile(join(DOCUMENTS_DIR, `${id}.json`), "utf-8");
      return JSON.parse(data) as Document;
    } catch {
      return null;
    }
  },

  async saveDocument(doc: Document): Promise<void> {
    await ensureDir(DOCUMENTS_DIR);
    await writeFile(
      join(DOCUMENTS_DIR, `${doc.id}.json`),
      JSON.stringify(doc, null, 2),
    );
  },

  async deleteDocument(id: string): Promise<boolean> {
    const filePath = join(DOCUMENTS_DIR, `${id}.json`);

    // Check if file exists before attempting delete
    if (!existsSync(filePath)) {
      return false; // File doesn't exist
    }

    try {
      await unlink(filePath);
      return true;
    } catch (error) {
      console.error("Failed to delete document:", error);
      return false;
    }
  },

  // ============ Templates ============

  async listTemplates(): Promise<Template[]> {
    try {
      const files = await readdir(TEMPLATES_DIR);
      const templates = await Promise.all(
        files
          .filter((f) => f.endsWith(".json"))
          .map(async (f) => {
            const data = await readFile(join(TEMPLATES_DIR, f), "utf-8");
            return JSON.parse(data) as Template;
          }),
      );
      return templates;
    } catch {
      return [];
    }
  },

  async getTemplate(id: string): Promise<Template | null> {
    try {
      const data = await readFile(join(TEMPLATES_DIR, `${id}.json`), "utf-8");
      return JSON.parse(data) as Template;
    } catch {
      return null;
    }
  },
};
