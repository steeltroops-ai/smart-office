import { Database } from "bun:sqlite";
import { mkdir, readdir, readFile } from "fs/promises";
import { join, dirname } from "path";

const DATA_DIR = "./data";
const DB_PATH = join(DATA_DIR, "smart_office.sqlite");

// Interfaces
export interface Document {
  id: string;
  title: string;
  content: any; // Stored as JSON string
  templateId?: string;
  settings?: any; // Stored as JSON string
  createdAt: string;
  updatedAt: string;
  // Locking
  lockedBy?: string | null;
  lockedAt?: string | null;
}

export interface DocumentMetadata {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  lockedBy?: string | null;
}

class StorageService {
  private db: Database;
  private initialized: Promise<void>;

  constructor() {
    this.db = new Database(DB_PATH, { create: true });
    // Enable WAL for concurrency
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.initialized = this.init();
  }

  private async migrateSchema() {
    // Basic migration helper for V1 POC
    const addColumn = (colDef: string) => {
      try {
        this.db.run(`ALTER TABLE documents ADD COLUMN ${colDef}`);
        console.log(`[Storage] Migrated schema: Added ${colDef}`);
      } catch (e: any) {
        // Ignore "duplicate column name" error
        if (!e.message.includes("duplicate column name")) {
          console.warn(`[Storage] Migration warning for ${colDef}:`, e.message);
        }
      }
    };

    addColumn("locked_by TEXT");
    addColumn("locked_at TEXT");
    addColumn("settings TEXT");
  }

  private async init() {
    await mkdir(DATA_DIR, { recursive: true });

    this.db.run(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL, -- JSON string
        template_id TEXT,
        settings TEXT, -- JSON string
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        locked_by TEXT,
        locked_at TEXT
      )
    `);

    // Ensure columns exist (for existing tables)
    await this.migrateSchema();

    // Index for faster listing/sorting
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_updated_at ON documents(updated_at DESC)`,
    );
  }

  async listDocuments(): Promise<DocumentMetadata[]> {
    await this.initialized;
    // Only fetch metadata, not the heavy content
    const query = this.db.query(`
      SELECT id, title, created_at as createdAt, updated_at as updatedAt, locked_by as lockedBy 
      FROM documents 
      ORDER BY updated_at DESC
    `);
    return query.all() as DocumentMetadata[];
  }

  async getDocument(id: string): Promise<Document | null> {
    await this.initialized;
    const query = this.db.query(`
      SELECT * FROM documents WHERE id = ?
    `);
    const row = query.get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      title: row.title,
      content: JSON.parse(row.content),
      templateId: row.template_id,
      settings: row.settings ? JSON.parse(row.settings) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lockedBy: row.locked_by,
      lockedAt: row.locked_at,
    };
  }

  async saveDocument(doc: Document): Promise<void> {
    await this.initialized;

    const query = this.db.query(`
      INSERT INTO documents (id, title, content, template_id, settings, created_at, updated_at, locked_by, locked_at)
      VALUES ($id, $title, $content, $templateId, $settings, $createdAt, $updatedAt, $lockedBy, $lockedAt)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        settings = excluded.settings,
        updated_at = excluded.updated_at,
        locked_by = excluded.locked_by,
        locked_at = excluded.locked_at
    `);

    query.run({
      $id: doc.id,
      $title: doc.title,
      $content: JSON.stringify(doc.content),
      $templateId: doc.templateId || null,
      $settings: doc.settings ? JSON.stringify(doc.settings) : null,
      $createdAt: doc.createdAt,
      $updatedAt: doc.updatedAt,
      $lockedBy: doc.lockedBy || null,
      $lockedAt: doc.lockedAt || null,
    });
  }

  async deleteDocument(id: string): Promise<boolean> {
    await this.initialized;
    const query = this.db.query(`DELETE FROM documents WHERE id = ?`);
    const result = query.run(id);
    return result.changes > 0;
  }

  // === Locking Mechanism ===

  async lockDocument(id: string, userId: string): Promise<boolean> {
    await this.initialized;
    // Try to acquire lock if null OR if expired (older than 30 mins) OR if owned by same user
    // Heartbeat logic: 90 seconds expiry for active heartbeat.
    // We'll use 2 minutes for safety margin in this query, client should heartbeat every 30s.

    // SQLite doesn't have easy "Time diff", so we check conditionally.
    // For now, simple "First come first serve" with overwrite if same user.

    const now = new Date().toISOString();

    const result = this.db.run(
      `
      UPDATE documents 
      SET locked_by = ?, locked_at = ?
      WHERE id = ? 
      AND (locked_by IS NULL OR locked_by = ? OR locked_at < datetime('now', '-2 minutes'))
    `,
      [userId, now, id, userId],
    );

    return result.changes > 0;
  }

  async unlockDocument(id: string, userId: string): Promise<boolean> {
    await this.initialized;
    const result = this.db.run(
      `
      UPDATE documents 
      SET locked_by = NULL, locked_at = NULL
      WHERE id = ? AND locked_by = ?
    `,
      [id, userId],
    );

    return result.changes > 0;
  }

  async heartbeat(id: string, userId: string): Promise<boolean> {
    // Just update the locked_at timestamp
    return this.lockDocument(id, userId);
  }

  // === Templates (Read-Only Files) ===

  async listTemplates(): Promise<any[]> {
    try {
      const templateDir = "./templates";
      await mkdir(templateDir, { recursive: true });
      const files = await readdir(templateDir);
      const templates = await Promise.all(
        files
          .filter((f: string) => f.endsWith(".json"))
          .map(async (f: string) => {
            const content = await readFile(join(templateDir, f), "utf-8");
            return JSON.parse(content);
          }),
      );
      return templates;
    } catch (error) {
      console.error("Error listing templates:", error);
      return [];
    }
  }

  async getTemplate(id: string): Promise<any | null> {
    try {
      const content = await readFile(
        join("./templates", `${id}.json`),
        "utf-8",
      );
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}

export const storage = new StorageService();
