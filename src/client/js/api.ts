// API Client Module - Smart Office POC
// Handles all communication with the backend server

const API_BASE = "/api";

// ============ Identity & Helpers ============

function getUserIdentity(): string {
  let userId = localStorage.getItem("x_user_id");
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("x_user_id", userId);
  }
  return userId;
}

// ============ Types ============

export interface DocumentSettings {
  pageSize?: "a4" | "letter" | "legal" | "a5";
  lineSpacing?: number;
}

export interface Document {
  id: string;
  title: string;
  content: object;
  templateId?: string | null;
  settings?: DocumentSettings | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  content?: object;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// ============ API Methods ============

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "X-User-ID": getUserIdentity(),
      ...options.headers,
    },
    ...options,
  });

  const result: ApiResponse<T> = await response.json();

  if (!result.success) {
    throw new ApiError(
      result.error?.code || "UNKNOWN_ERROR",
      result.error?.message || "Unknown error occurred",
    );
  }

  return result.data as T;
}

// ============ Document API ============

export const documentApi = {
  /**
   * List all documents (returns summaries without content)
   */
  async list(): Promise<DocumentSummary[]> {
    const data = await request<DocumentSummary[]>("/documents");
    return data || [];
  },

  /**
   * Get a single document by ID (includes full content)
   */
  async get(id: string): Promise<Document | null> {
    return request<Document>(`/documents/${id}`);
  },

  /**
   * Create a new document
   */
  async create(data: {
    title?: string;
    content?: object;
    templateId?: string;
    settings?: DocumentSettings;
  }): Promise<Document | null> {
    return request<Document>("/documents", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Update an existing document
   */
  async update(
    id: string,
    data: { title?: string; content?: object; settings?: DocumentSettings },
  ): Promise<Document | null> {
    return request<Document>(`/documents/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a document
   */
  async delete(id: string): Promise<boolean> {
    const result = await request<{ deleted: boolean }>(`/documents/${id}`, {
      method: "DELETE",
    });
    return result?.deleted ?? false;
  },

  /**
   * Send heartbeat to maintain document lock
   */
  async heartbeat(id: string): Promise<boolean> {
    const result = await request<{ locked: boolean }>(
      `/documents/${id}/heartbeat`,
      {
        method: "POST",
      },
    );
    return result?.locked ?? false;
  },
};

// ============ Template API ============

export const templateApi = {
  /**
   * List all templates (returns summaries without content)
   */
  async list(): Promise<Template[]> {
    const data = await request<Template[]>("/templates");
    return data || [];
  },

  /**
   * Get a single template by ID (includes full content)
   */
  async get(id: string): Promise<Template | null> {
    return request<Template>(`/templates/${id}`);
  },
};
