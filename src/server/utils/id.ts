// ID Generator Utility - Smart Office POC
// Generates prefixed unique IDs for documents and templates

/**
 * Generate a unique ID with a prefix
 * Format: prefix_xxxxxxxx (8 random alphanumeric chars)
 *
 * @param prefix - Prefix for the ID (e.g., 'doc', 'tmpl')
 * @returns Unique ID string
 */
export function generateId(prefix: string = "id"): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";

  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }

  return `${prefix}_${id}`;
}
