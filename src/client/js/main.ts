// Smart Office - Main Application Entry
// Integrates TipTap editor, API client, and UI

import { DocumentEditor } from "./editor";
import {
  documentApi,
  templateApi,
  type DocumentSummary,
  type Template,
  type DocumentSettings,
} from "./api";
import { VoiceInput } from "./voice";

// ============ Application State ============

interface AppState {
  currentDocId: string | null;
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  editor: DocumentEditor | null;
  voiceInput: VoiceInput | null;
  autoSaveTimer: any | null;
}

const state: AppState = {
  currentDocId: null,
  isDirty: false,
  isSaving: false,
  isLoading: false,
  editor: null,
  voiceInput: null,
  autoSaveTimer: null,
};

// ============ DOM Elements ============

const elements = {
  docTitle: document.getElementById("doc-title") as HTMLInputElement,
  saveStatus: document.getElementById("save-status") as HTMLElement,
  btnSave: document.getElementById("btn-save") as HTMLButtonElement,
  btnNew: document.getElementById("btn-new") as HTMLButtonElement,
  btnExport: document.getElementById("btn-export") as HTMLButtonElement,
  btnVoice: document.getElementById("btn-voice") as HTMLButtonElement,
  btnDelete: document.getElementById("btn-delete") as HTMLButtonElement,
  documentList: document.getElementById("document-list") as HTMLElement,
  templateList: document.getElementById("template-list") as HTMLElement,
  editorEl: document.getElementById("editor") as HTMLElement,
  statusText: document.getElementById("status-text") as HTMLElement,
  wordCount: document.getElementById("word-count") as HTMLElement,
  toolbar: document.getElementById("toolbar") as HTMLElement,
  pageSize: document.getElementById("page-size") as HTMLSelectElement,
  lineSpacing: document.getElementById("line-spacing") as HTMLSelectElement,
  fontFamily: document.getElementById("font-family") as HTMLSelectElement,
  fontSize: document.getElementById("font-size") as HTMLSelectElement,
  btnMenu: document.getElementById("btn-menu") as HTMLButtonElement,
  sidebar: document.getElementById("sidebar") as HTMLElement,
  sidebarOverlay: document.getElementById("sidebar-overlay") as HTMLElement,
};

// ============ UI Helpers ============

function updateStatus(
  text: string,
  type: "default" | "saving" | "saved" | "error" = "default",
): void {
  elements.statusText.textContent = text;
  elements.saveStatus.textContent = text;
  elements.saveStatus.className = "save-status " + type;
}

function updateWordCount(): void {
  if (state.editor) {
    const count = state.editor.getWordCount();
    elements.wordCount.textContent = `${count} word${count !== 1 ? "s" : ""}`;
  }
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function markDirty(): void {
  if (!state.isDirty) {
    state.isDirty = true;
    updateStatus("Unsaved changes");
    updateDeleteButton();
  }

  // Clear existing timer
  if (state.autoSaveTimer) clearTimeout(state.autoSaveTimer);

  if (state.currentDocId) {
    // Auto-save for existing documents
    state.autoSaveTimer = setTimeout(() => {
      saveDocument(true); // true = silent/auto save
    }, 2000);
  } else {
    // Save draft for new unsaved documents (prevents data loss)
    state.autoSaveTimer = setTimeout(() => {
      saveDraft();
      updateStatus("Draft saved locally");
    }, 2000);
  }
}

function updateDeleteButton(): void {
  if (elements.btnDelete) {
    // Show delete button only when viewing a saved document
    elements.btnDelete.style.display = state.currentDocId
      ? "inline-flex"
      : "none";
  }
}

// ============ Auto-save Timer Management ============

/**
 * Clear any pending auto-save timer to prevent race conditions
 * Call this before switching documents or starting manual save
 */
function clearAutoSaveTimer(): void {
  if (state.autoSaveTimer) {
    clearTimeout(state.autoSaveTimer);
    state.autoSaveTimer = null;
  }
}

// ============ Mobile Sidebar Management ============

function toggleSidebar(forceState?: boolean): void {
  const isOpen =
    forceState !== undefined
      ? forceState
      : elements.sidebar.classList.contains("open");

  if (isOpen) {
    elements.sidebar.classList.remove("open");
    elements.sidebarOverlay.classList.remove("active");
  } else {
    elements.sidebar.classList.add("open");
    elements.sidebarOverlay.classList.add("active");
  }
}

// ============ Draft Storage for New Documents ============

const DRAFT_KEY = "smart-office-draft";

interface Draft {
  title: string;
  content: object;
  timestamp: number;
}

/**
 * Save current unsaved document as a draft to localStorage
 * Only saves if there's actual content worth preserving
 */
function saveDraft(): void {
  if (!state.currentDocId && state.editor) {
    const title = elements.docTitle.value || "Untitled Document";
    const content = state.editor.getJSON();
    const charCount = state.editor.getCharacterCount();

    // Only save if there's actual content or a custom title
    if (charCount > 0 || (title !== "Untitled Document" && title !== "")) {
      const draft: Draft = {
        title,
        content,
        timestamp: Date.now(),
      };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        console.log("[Smart Office] Draft saved to localStorage");
      } catch (e) {
        console.warn("[Smart Office] Failed to save draft:", e);
      }
    }
  }
}

/**
 * Load draft from localStorage if it exists
 */
function loadDraft(): Draft | null {
  try {
    const data = localStorage.getItem(DRAFT_KEY);
    if (data) {
      return JSON.parse(data) as Draft;
    }
  } catch (e) {
    console.warn("[Smart Office] Failed to load draft:", e);
  }
  return null;
}

/**
 * Clear draft from localStorage
 */
function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (e) {
    // Ignore errors
  }
}

// ============ Content Validation ============

/**
 * Validate TipTap content structure to prevent crashes on load
 */
function isValidTipTapContent(content: any): boolean {
  if (!content || typeof content !== "object") return false;
  if (content.type !== "doc") return false;
  // content.content can be undefined for empty docs, but if present must be array
  if (content.content !== undefined && !Array.isArray(content.content))
    return false;
  return true;
}

// ============ Unsaved Changes Handler ============

/**
 * Smart handler for unsaved changes when switching context
 * Returns: 'proceed' if user wants to continue, 'cancel' if user wants to stay
 */
async function handleUnsavedChanges(): Promise<"proceed" | "cancel"> {
  if (!state.isDirty) return "proceed";

  // First prompt: offer to save
  const wantToSave = window.confirm(
    "You have unsaved changes.\n\n" +
      "Click OK to save before continuing, or Cancel to choose another option.",
  );

  if (wantToSave) {
    await saveDocument(false);
    // Check if save succeeded
    if (!state.isDirty) {
      return "proceed";
    }
    // Save failed - inform user
    const discardAnyway = window.confirm(
      "Save failed. Discard your changes and continue anyway?",
    );
    return discardAnyway ? "proceed" : "cancel";
  }

  // User didn't want to save - ask about discarding
  const discardChanges = window.confirm("Discard your unsaved changes?");
  return discardChanges ? "proceed" : "cancel";
}

function setLoading(loading: boolean): void {
  state.isLoading = loading;
  elements.btnSave.disabled = loading;
  elements.btnNew.disabled = loading;
  elements.btnExport.disabled = loading;
  if (elements.btnDelete) {
    elements.btnDelete.disabled = loading;
  }
}

// ============ Document List Rendering ============

function renderDocumentList(documents: DocumentSummary[]): void {
  if (!documents || documents.length === 0) {
    elements.documentList.innerHTML = `
      <div class="empty-state">
        <p>No documents yet.</p>
        <p class="text-muted">Create your first document!</p>
      </div>
    `;
    return;
  }

  elements.documentList.innerHTML = documents
    .map(
      (doc) => `
    <div class="doc-item-wrapper">
      <button 
        class="doc-item ${doc.id === state.currentDocId ? "active" : ""}" 
        data-id="${doc.id}"
        title="${escapeHtml(doc.title)}"
      >
        <span class="doc-item-title">${escapeHtml(doc.title)}</span>
        <span class="doc-item-date">${formatDate(doc.updatedAt)}</span>
      </button>
      <button 
        class="doc-item-delete" 
        data-id="${doc.id}"
        title="Delete document"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  `,
    )
    .join("");

  // Add click handlers for document selection
  elements.documentList.querySelectorAll(".doc-item").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = (btn as HTMLElement).dataset.id;
      if (id) {
        loadDocument(id);
        // Close sidebar on mobile after selection
        if (window.innerWidth <= 768) {
          toggleSidebar(false);
        }
      }
    });
  });

  // Add click handlers for delete buttons
  elements.documentList.querySelectorAll(".doc-item-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = (btn as HTMLElement).dataset.id;
      if (id) deleteDocument(id);
    });
  });
}

function renderTemplateList(templates: Template[]): void {
  if (!templates || templates.length === 0) {
    elements.templateList.innerHTML =
      '<p class="text-muted">No templates available.</p>';
    return;
  }

  elements.templateList.innerHTML = templates
    .map(
      (tmpl) => `
    <button 
      class="template-item" 
      data-id="${tmpl.id}"
      title="${escapeHtml(tmpl.description)}"
    >
      <svg class="template-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
      <span class="template-name">${escapeHtml(tmpl.name)}</span>
    </button>
  `,
    )
    .join("");

  // Add click handlers
  elements.templateList.querySelectorAll(".template-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = (btn as HTMLElement).dataset.id;
      if (id) {
        loadTemplate(id);
        // Close sidebar on mobile after selection
        if (window.innerWidth <= 768) {
          toggleSidebar(false);
        }
      }
    });
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ============ Document Settings Helpers ============

/**
 * Apply page size to the editor element
 * Note: Classes are applied to #editor element to match CSS selectors
 */
function applyPageSize(size: string): void {
  // Apply class directly to #editor element (matches CSS: #editor.page-a4, etc.)
  elements.editorEl.classList.remove(
    "page-a4",
    "page-letter",
    "page-legal",
    "page-a5",
  );
  elements.editorEl.classList.add(`page-${size}`);
}

/**
 * Apply line spacing to the editor content
 */
function applyLineSpacing(spacing: number): void {
  const proseMirror = elements.editorEl.querySelector(".ProseMirror");
  if (proseMirror) {
    (proseMirror as HTMLElement).style.lineHeight = spacing.toString();
  }
}

/**
 * Get current document settings from UI
 */
function getCurrentSettings(): DocumentSettings {
  return {
    pageSize: (elements.pageSize?.value ||
      "a4") as DocumentSettings["pageSize"],
    lineSpacing: parseFloat(elements.lineSpacing?.value || "1.15"),
  };
}

// ============ Document Operations ============

async function loadDocuments(): Promise<void> {
  const docs = await documentApi.list();
  renderDocumentList(docs);
}

async function loadTemplates(): Promise<void> {
  const templates = await templateApi.list();
  renderTemplateList(templates);
}

async function loadDocument(id: string): Promise<void> {
  // Clear pending auto-save to prevent saving to wrong document
  clearAutoSaveTimer();

  // Handle unsaved changes with save option
  const action = await handleUnsavedChanges();
  if (action === "cancel") return;

  setLoading(true);
  updateStatus("Loading...", "saving");

  try {
    const doc = await documentApi.get(id);
    if (doc) {
      state.currentDocId = doc.id;
      elements.docTitle.value = doc.title;

      // Validate and set content with error handling
      if (state.editor && doc.content) {
        if (isValidTipTapContent(doc.content)) {
          try {
            state.editor.setContent(doc.content);
          } catch (e) {
            console.error("Failed to set document content:", e);
            updateStatus("Content error, using empty document", "error");
            state.editor.clear();
          }
        } else {
          console.warn(
            "Invalid document content structure, using empty document",
          );
          state.editor.clear();
        }
      } else if (state.editor) {
        state.editor.clear();
      }

      // Apply document settings (page size, line spacing)
      if (doc.settings) {
        if (doc.settings.pageSize && elements.pageSize) {
          elements.pageSize.value = doc.settings.pageSize;
          applyPageSize(doc.settings.pageSize);
        }
        if (doc.settings.lineSpacing && elements.lineSpacing) {
          elements.lineSpacing.value = doc.settings.lineSpacing.toString();
          applyLineSpacing(doc.settings.lineSpacing);
        }
      }

      state.isDirty = false;
      clearDraft(); // Clear any draft since we loaded a saved doc
      updateStatus("Loaded", "saved");
      updateWordCount();
      updateDeleteButton();
      await loadDocuments(); // Refresh list to update active state
    } else {
      updateStatus("Failed to load", "error");
    }
  } catch (error) {
    console.error("Load error:", error);
    updateStatus("Failed to load", "error");
  } finally {
    setLoading(false);
  }
}

// Load template content into editor WITHOUT saving
async function loadTemplate(templateId: string): Promise<void> {
  // Clear pending auto-save to prevent saving to wrong document
  clearAutoSaveTimer();

  // Handle unsaved changes with save option
  const action = await handleUnsavedChanges();
  if (action === "cancel") return;

  setLoading(true);
  updateStatus("Loading template...", "saving");

  try {
    const template = await templateApi.get(templateId);
    if (template && template.content) {
      // Don't create document yet - just load template into editor
      state.currentDocId = null;
      elements.docTitle.value = template.name;

      if (state.editor) {
        state.editor.setContent(template.content);
      }

      state.isDirty = true; // Mark as dirty since it's unsaved
      clearDraft(); // Clear any previous draft
      updateStatus("Template loaded - click Save to create document");
      updateWordCount();
      updateDeleteButton();

      // Remove active state from document list
      elements.documentList.querySelectorAll(".doc-item").forEach((item) => {
        item.classList.remove("active");
      });

      // Focus title for renaming
      elements.docTitle.focus();
      elements.docTitle.select();
    } else {
      updateStatus("Failed to load template", "error");
    }
  } catch (error) {
    console.error("Template load error:", error);
    updateStatus("Failed to load template", "error");
  } finally {
    setLoading(false);
  }
}

async function saveDocument(isAutoSave = false, retryCount = 0): Promise<void> {
  // Clear pending auto-save timer to prevent race conditions
  clearAutoSaveTimer();

  if (state.isSaving || state.isLoading) return;

  state.isSaving = true;
  if (!isAutoSave) setLoading(true); // Don't block UI for auto-save
  updateStatus(isAutoSave ? "Auto-saving..." : "Saving...", "saving");

  const title = elements.docTitle.value.trim();
  const content = state.editor?.getJSON() || { type: "doc", content: [] };
  const isContentEmpty = state.editor?.getCharacterCount() === 0;

  // Validation: Don't create new documents that are completely empty
  if (
    !state.currentDocId &&
    (!title || title === "Untitled Document") &&
    isContentEmpty
  ) {
    updateStatus("Add title or content to save", "error");
    state.isSaving = false;
    if (!isAutoSave) setLoading(false);
    return;
  }

  // Validation: Warn when saving an existing document that is empty (SE-001)
  if (!isAutoSave && state.currentDocId && isContentEmpty) {
    const confirmSave = window.confirm(
      "This document is empty. Are you sure you want to save it?",
    );
    if (!confirmSave) {
      state.isSaving = false;
      setLoading(false);
      return;
    }
  }

  const finalTitle = title || "Untitled Document";
  const settings = getCurrentSettings();

  try {
    let doc;
    if (state.currentDocId) {
      doc = await documentApi.update(state.currentDocId, {
        title: finalTitle,
        content,
        settings,
      });
    } else {
      doc = await documentApi.create({ title: finalTitle, content, settings });
    }

    if (doc) {
      state.currentDocId = doc.id;
      state.isDirty = false;
      clearDraft(); // Clear draft after successful save
      updateStatus("Saved", "saved");
      updateDeleteButton();
      await loadDocuments();
    } else {
      throw new Error("Save failed (api returned null)");
    }
  } catch (error) {
    console.error("Save error:", error);

    // Auto-save retry logic (AS-002)
    if (isAutoSave && retryCount < 2) {
      const nextDelay = 1000 * (retryCount + 1);
      console.warn(`Auto-save failed, retrying in ${nextDelay}ms...`);

      state.isSaving = false; // Reset flag to allow retry

      setTimeout(() => {
        saveDocument(true, retryCount + 1);
      }, nextDelay);
      return;
    }

    updateStatus("Save failed", "error");
  } finally {
    // Only reset if we are NOT retrying, or if we exhausted retries
    if (!isAutoSave || retryCount >= 2) {
      state.isSaving = false;
      if (!isAutoSave) setLoading(false);
    }
  }
}

async function createNewDocument(): Promise<void> {
  // Clear pending auto-save timer
  clearAutoSaveTimer();

  // Handle unsaved changes with save option
  const action = await handleUnsavedChanges();
  if (action === "cancel") return;

  state.currentDocId = null;
  elements.docTitle.value = "";
  state.editor?.clear();
  state.isDirty = false;
  clearDraft(); // Clear any saved draft
  updateStatus("New document");
  updateWordCount();
  updateDeleteButton();

  // Remove active state from list
  elements.documentList.querySelectorAll(".doc-item").forEach((item) => {
    item.classList.remove("active");
  });

  // Focus editor
  state.editor?.focus();
}

async function deleteDocument(id: string): Promise<void> {
  const confirmDelete = window.confirm(
    "Are you sure you want to delete this document?",
  );
  if (!confirmDelete) return;

  setLoading(true);
  updateStatus("Deleting...", "saving");

  try {
    const success = await documentApi.delete(id);
    if (success) {
      // If we deleted the current document, clear the editor
      if (id === state.currentDocId) {
        state.currentDocId = null;
        elements.docTitle.value = "";
        state.editor?.clear();
        state.isDirty = false;
        updateDeleteButton();
      }
      await loadDocuments();
      updateStatus("Document deleted", "saved");
    } else {
      updateStatus("Delete failed", "error");
    }
  } catch (error) {
    console.error("Delete error:", error);
    updateStatus("Delete failed", "error");
  } finally {
    setLoading(false);
  }
}

async function deleteCurrentDocument(): Promise<void> {
  if (!state.currentDocId) return;
  await deleteDocument(state.currentDocId);
}

// ============ PDF Export ============

/**
 * Page size configurations (width x height in mm)
 */
const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
  letter: { width: 215.9, height: 279.4 },
  legal: { width: 215.9, height: 355.6 },
};

const PDF_MARGIN = 25.4; // 1 inch in mm

/**
 * Interface for text segments with ALL formatting properties
 */
interface TextSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  superscript: boolean;
  subscript: boolean;
  fontSize: number | null; // Custom font size in pt, null = default
  fontFamily: string | null;
  color: string | null; // Hex color
  highlight: string | null; // Highlight background color
}

/**
 * Map TipTap font family to jsPDF font
 * jsPDF only supports: helvetica, times, courier
 */
function mapFontFamily(fontFamily: string | null): string {
  if (!fontFamily) return "helvetica";
  const lower = fontFamily.toLowerCase();
  if (lower.includes("times") || lower.includes("serif")) return "times";
  if (lower.includes("courier") || lower.includes("mono")) return "courier";
  return "helvetica";
}

/**
 * Parse hex color string to RGB
 */
function parseColor(
  color: string | null,
): { r: number; g: number; b: number } | null {
  if (!color) return null;
  // Handle hex colors
  const hex = color.replace("#", "");
  if (hex.length === 6) {
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
    };
  }
  // Handle rgb() format
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
    };
  }
  return null;
}

/**
 * Parse font size string (e.g., "14pt", "16px") to points
 */
function parseFontSize(size: string | null | undefined): number | null {
  if (!size) return null;
  const match = size.match(/(\d+(?:\.\d+)?)(pt|px)?/);
  if (match) {
    const value = parseFloat(match[1]);
    const unit = match[2] || "pt";
    // Convert px to pt (1px = 0.75pt approximately)
    return unit === "px" ? value * 0.75 : value;
  }
  return null;
}

/**
 * Export document to PDF with COMPLETE FORMATTING SUPPORT
 * Supports: alignment, font sizes, bold, italic, underline, strike,
 * colors, highlights, subscript, superscript
 */
async function exportPdf(): Promise<void> {
  if (!state.editor) return;

  if (state.editor.getCharacterCount() === 0) {
    alert("Cannot export an empty document. Please add some text first.");
    return;
  }

  if (state.isDirty) {
    const confirmSave = window.confirm(
      "You have unsaved changes. Save before exporting to ensure latest version?",
    );
    if (confirmSave) {
      await saveDocument();
    }
  }

  setLoading(true);
  updateStatus("Generating PDF...", "saving");

  try {
    const { jsPDF } = await import("jspdf");

    const title = elements.docTitle.value || "Untitled Document";
    const content = state.editor.getJSON() as any;

    // Get page size and line spacing from settings
    const pageSizeKey = elements.pageSize?.value || "a4";
    const pageSize = PAGE_SIZES[pageSizeKey] || PAGE_SIZES.a4;
    const lineSpacing = parseFloat(elements.lineSpacing?.value || "1.15");

    // Create PDF
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [pageSize.width, pageSize.height],
    });

    const pageWidth = pageSize.width;
    const pageHeight = pageSize.height;
    const margin = PDF_MARGIN;
    const maxWidth = pageWidth - margin * 2;
    const baseFontSize = 11; // Default body font size in pt
    const baseLineHeight = baseFontSize * 0.38 * lineSpacing; // Line height in mm

    let y = margin;
    let currentPage = 1;

    // ========== HELPER FUNCTIONS ==========

    /**
     * Check if we need a page break
     */
    const checkPageBreak = (heightNeeded: number): void => {
      if (y + heightNeeded > pageHeight - margin) {
        pdf.addPage([pageSize.width, pageSize.height]);
        currentPage++;
        y = margin;
      }
    };

    /**
     * Set font style in PDF
     */
    const setFont = (
      family: string | null,
      bold: boolean,
      italic: boolean,
      size: number,
    ): void => {
      const pdfFont = mapFontFamily(family);
      pdf.setFontSize(size);
      if (bold && italic) {
        pdf.setFont(pdfFont, "bolditalic");
      } else if (bold) {
        pdf.setFont(pdfFont, "bold");
      } else if (italic) {
        pdf.setFont(pdfFont, "italic");
      } else {
        pdf.setFont(pdfFont, "normal");
      }
    };

    /**
     * Extract all text segments with formatting from node content
     */
    const extractSegments = (nodeContent: any[] | undefined): TextSegment[] => {
      if (!nodeContent || !Array.isArray(nodeContent)) return [];

      const segments: TextSegment[] = [];

      for (const item of nodeContent) {
        if (item.type === "text" && item.text) {
          const marks = item.marks || [];

          // Extract all formatting from marks
          let fontSize: number | null = null;
          let fontFamily: string | null = null;
          let color: string | null = null;
          let highlight: string | null = null;

          for (const mark of marks) {
            if (mark.type === "textStyle") {
              if (mark.attrs?.fontSize) {
                fontSize = parseFontSize(mark.attrs.fontSize);
              }
              if (mark.attrs?.fontFamily) {
                fontFamily = mark.attrs.fontFamily;
              }
              if (mark.attrs?.color) {
                color = mark.attrs.color;
              }
            }
            if (mark.type === "highlight" && mark.attrs?.color) {
              highlight = mark.attrs.color;
            }
          }

          segments.push({
            text: item.text,
            bold: marks.some((m: any) => m.type === "bold"),
            italic: marks.some((m: any) => m.type === "italic"),
            underline: marks.some((m: any) => m.type === "underline"),
            strike: marks.some((m: any) => m.type === "strike"),
            superscript: marks.some((m: any) => m.type === "superscript"),
            subscript: marks.some((m: any) => m.type === "subscript"),
            fontSize,
            fontFamily,
            color,
            highlight,
          });
        }
      }

      return segments;
    };

    /**
     * Get X position based on alignment
     */
    const getAlignedX = (
      align: string | undefined,
      textWidth: number,
      indent: number,
    ): number => {
      const effectiveWidth = maxWidth - indent;
      switch (align) {
        case "center":
          return margin + indent + effectiveWidth / 2;
        case "right":
          return margin + indent + effectiveWidth;
        default:
          return margin + indent;
      }
    };

    /**
     * Get jsPDF alignment option
     */
    const getJsPdfAlign = (
      align: string | undefined,
    ): "left" | "center" | "right" => {
      if (align === "center") return "center";
      if (align === "right") return "right";
      return "left";
    };

    /**
     * Render text segments with full formatting support
     */
    const renderSegments = (
      segments: TextSegment[],
      align: string | undefined,
      indent: number = 0,
      defaultSize: number = baseFontSize,
      forceBold: boolean = false,
      prefix: string = "",
    ): void => {
      if (segments.length === 0 && !prefix) {
        y += baseLineHeight * 0.5;
        return;
      }

      const effectiveWidth = maxWidth - indent;
      const alignment = getJsPdfAlign(align);

      // Build the full text for word wrapping
      const fullText = prefix + segments.map((s) => s.text).join("");

      // For simplicity with mixed formatting, we render line by line
      // First, calculate wrapped lines
      setFont(null, forceBold, false, defaultSize);
      const lines = pdf.splitTextToSize(fullText, effectiveWidth);

      // Track position in original text
      let charIndex = 0;
      const prefixLen = prefix.length;

      for (const line of lines) {
        checkPageBreak(baseLineHeight + 2);

        // Calculate line height based on largest font in this line
        let maxFontSize = defaultSize;
        let lineCharStart = charIndex;
        let lineCharEnd = charIndex + line.length;

        // For prefix on first line
        if (charIndex === 0 && prefix) {
          // Draw prefix first
          setFont(null, false, false, defaultSize);
          pdf.setTextColor(0, 0, 0);
          const prefixX = getAlignedX(align, pdf.getTextWidth(line), indent);
          pdf.text(prefix, prefixX, y, { align: alignment });
        }

        // Find segments that overlap this line
        let currentX = getAlignedX(align, pdf.getTextWidth(line), indent);
        if (alignment === "left" && charIndex === 0 && prefix) {
          currentX += pdf.getTextWidth(prefix);
        }

        // Determine which segments are in this line
        let segmentPos = 0;
        for (const segment of segments) {
          const segStart = prefixLen + segmentPos;
          const segEnd = segStart + segment.text.length;
          segmentPos += segment.text.length;

          // Check if this segment overlaps with current line
          if (segEnd <= lineCharStart || segStart >= lineCharEnd) {
            continue; // No overlap
          }

          // Calculate the portion of segment in this line
          const overlapStart = Math.max(segStart, lineCharStart);
          const overlapEnd = Math.min(segEnd, lineCharEnd);
          const textInLine = fullText.substring(overlapStart, overlapEnd);

          if (!textInLine) continue;

          // Apply segment formatting
          const fontSize = segment.fontSize || defaultSize;
          const fontFamily = segment.fontFamily;
          const isBold = forceBold || segment.bold;
          const isItalic = segment.italic;

          // Set font
          setFont(fontFamily, isBold, isItalic, fontSize);

          // Set text color
          if (segment.color) {
            const rgb = parseColor(segment.color);
            if (rgb) {
              pdf.setTextColor(rgb.r, rgb.g, rgb.b);
            } else {
              pdf.setTextColor(0, 0, 0);
            }
          } else {
            pdf.setTextColor(0, 0, 0);
          }

          // Get text width for decorations
          const textWidth = pdf.getTextWidth(textInLine);

          // Draw highlight background if present
          if (segment.highlight) {
            const rgb = parseColor(segment.highlight);
            if (rgb) {
              pdf.setFillColor(rgb.r, rgb.g, rgb.b);
              const rectHeight = fontSize * 0.4;
              pdf.rect(
                currentX,
                y - rectHeight + 0.5,
                textWidth,
                rectHeight,
                "F",
              );
            }
          }

          // Adjust Y for subscript/superscript
          let renderY = y;
          let renderSize = fontSize;
          if (segment.subscript) {
            renderY = y + fontSize * 0.15;
            renderSize = fontSize * 0.7;
            pdf.setFontSize(renderSize);
          } else if (segment.superscript) {
            renderY = y - fontSize * 0.2;
            renderSize = fontSize * 0.7;
            pdf.setFontSize(renderSize);
          }

          // Draw the text (for left-aligned, we draw segment by segment)
          if (alignment === "left") {
            pdf.text(textInLine, currentX, renderY);
            currentX += textWidth;
          }

          // Draw underline
          if (segment.underline) {
            const underlineY = renderY + 0.5;
            pdf.setDrawColor(
              segment.color ? parseColor(segment.color)?.r || 0 : 0,
              segment.color ? parseColor(segment.color)?.g || 0 : 0,
              segment.color ? parseColor(segment.color)?.b || 0 : 0,
            );
            pdf.setLineWidth(0.2);
            pdf.line(currentX - textWidth, underlineY, currentX, underlineY);
          }

          // Draw strikethrough
          if (segment.strike) {
            const strikeY = renderY - fontSize * 0.1;
            pdf.setDrawColor(
              segment.color ? parseColor(segment.color)?.r || 0 : 0,
              segment.color ? parseColor(segment.color)?.g || 0 : 0,
              segment.color ? parseColor(segment.color)?.b || 0 : 0,
            );
            pdf.setLineWidth(0.2);
            pdf.line(currentX - textWidth, strikeY, currentX, strikeY);
          }

          maxFontSize = Math.max(maxFontSize, fontSize);
        }

        // For center/right alignment, draw the whole line at once (simpler approach)
        if (alignment !== "left") {
          // Determine dominant style for the line
          const hasAnyBold = segments.some((s) => s.bold) || forceBold;
          const hasAnyItalic = segments.some((s) => s.italic);
          setFont(null, hasAnyBold, hasAnyItalic, defaultSize);
          pdf.setTextColor(0, 0, 0);
          const lineX = getAlignedX(align, pdf.getTextWidth(line), indent);
          pdf.text(line, lineX, y, { align: alignment });
        }

        // Move to next line
        y += maxFontSize * 0.38 * lineSpacing;
        charIndex += line.length;

        // Skip whitespace between lines
        while (charIndex < fullText.length && fullText[charIndex] === " ") {
          charIndex++;
        }
      }

      y += baseLineHeight * 0.2;
    };

    // ========== RENDER NODE FUNCTION ==========

    /**
     * Render TipTap nodes recursively
     */
    const renderNode = (
      node: any,
      listType?: string,
      listIdx?: number,
      indent: number = 0,
    ): void => {
      if (!node) return;

      // Get text alignment from node attributes
      const textAlign = node.attrs?.textAlign;

      switch (node.type) {
        case "heading": {
          const level = node.attrs?.level || 1;
          const fontSize = level === 1 ? 24 : level === 2 ? 18 : 14;
          const segments = extractSegments(node.content);

          if (segments.length > 0 || node.content?.length) {
            y += baseLineHeight * 0.6;
            renderSegments(segments, textAlign, indent, fontSize, true);
            y += baseLineHeight * 0.3;
          }
          break;
        }

        case "paragraph": {
          const segments = extractSegments(node.content);
          let prefix = "";

          if (listType === "bullet") {
            prefix = "  \u2022 "; // Bullet character
          } else if (listType === "ordered" && listIdx !== undefined) {
            prefix = `  ${listIdx}. `;
          }

          renderSegments(
            segments,
            textAlign,
            indent,
            baseFontSize,
            false,
            prefix,
          );
          break;
        }

        case "bulletList": {
          (node.content || []).forEach((item: any) => {
            renderNode(item, "bullet", undefined, indent);
          });
          break;
        }

        case "orderedList": {
          (node.content || []).forEach((item: any, idx: number) => {
            renderNode(item, "ordered", idx + 1, indent);
          });
          break;
        }

        case "listItem": {
          (node.content || []).forEach((child: any) => {
            renderNode(child, listType, listIdx, indent + 6);
          });
          break;
        }

        case "blockquote": {
          y += baseLineHeight * 0.3;
          const startY = y;

          (node.content || []).forEach((child: any) => {
            const segments = extractSegments(child.content);
            // Force italic for blockquotes
            const italicSegments = segments.map((s) => ({
              ...s,
              italic: true,
            }));
            renderSegments(
              italicSegments,
              child.attrs?.textAlign,
              indent + 8,
              baseFontSize,
            );
          });

          // Draw left border
          pdf.setDrawColor(180, 180, 180);
          pdf.setLineWidth(0.5);
          pdf.line(margin + indent + 3, startY - 2, margin + indent + 3, y - 2);
          y += baseLineHeight * 0.3;
          break;
        }

        case "horizontalRule": {
          checkPageBreak(10);
          y += baseLineHeight * 0.5;
          pdf.setDrawColor(200, 200, 200);
          pdf.setLineWidth(0.3);
          pdf.line(margin, y, pageWidth - margin, y);
          y += baseLineHeight * 0.5;
          break;
        }

        case "codeBlock": {
          const segments = extractSegments(node.content);
          const codeText = segments.map((s) => s.text).join("");

          if (codeText) {
            y += baseLineHeight * 0.3;

            // Draw background
            const codeLines = codeText.split("\n");
            const bgHeight = codeLines.length * 3.5 + 4;
            checkPageBreak(bgHeight);
            pdf.setFillColor(245, 245, 245);
            pdf.rect(margin + indent, y - 3, maxWidth - indent, bgHeight, "F");

            // Draw code text
            pdf.setFont("courier", "normal");
            pdf.setFontSize(9);
            pdf.setTextColor(50, 50, 50);

            for (const codeLine of codeLines) {
              const wrapped = pdf.splitTextToSize(
                codeLine || " ",
                maxWidth - indent - 10,
              );
              for (const wl of wrapped) {
                checkPageBreak(4);
                pdf.text(wl, margin + indent + 3, y);
                y += 3.5;
              }
            }

            y += baseLineHeight * 0.3;
            pdf.setTextColor(0, 0, 0);
            setFont(null, false, false, baseFontSize);
          }
          break;
        }

        default:
          if (node.content && Array.isArray(node.content)) {
            node.content.forEach((child: any) => {
              renderNode(child, listType, listIdx, indent);
            });
          }
      }
    };

    // ========== RENDER DOCUMENT ==========

    const docContent = content.content || [];
    for (const node of docContent) {
      renderNode(node);
    }

    // Save PDF
    const safeFilename =
      title
        .replace(/[^a-zA-Z0-9\s-]/g, "_")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "") || "document";

    pdf.save(`${safeFilename}.pdf`);
    updateStatus("PDF exported", "saved");
  } catch (error) {
    console.error("PDF export error:", error);
    updateStatus("PDF export failed", "error");
    alert(
      `PDF export failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    setLoading(false);
  }
}

// ============ Toolbar Handling ============

function setupToolbar(): void {
  // Enable horizontal scroll with mouse wheel/touchpad
  elements.toolbar.addEventListener(
    "wheel",
    (e) => {
      // Only handle if there's horizontal overflow (scrollable)
      if (elements.toolbar.scrollWidth > elements.toolbar.clientWidth) {
        e.preventDefault();
        // Use deltaY (vertical scroll) to scroll horizontally
        elements.toolbar.scrollLeft += e.deltaY;
      }
    },
    { passive: false },
  );

  // Handle toolbar button clicks
  elements.toolbar.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(
      ".toolbar-btn",
    ) as HTMLElement;
    if (!btn || !state.editor) return;

    const command = btn.dataset.command;
    if (!command) return;

    // Prevent voice button from being handled here (it has its own handler)
    if (command === "voice") return;

    switch (command) {
      case "bold":
        state.editor.toggleBold();
        break;
      case "italic":
        state.editor.toggleItalic();
        break;
      case "underline":
        state.editor.toggleUnderline();
        break;
      case "strike":
        state.editor.toggleStrike();
        break;
      case "alignLeft":
        state.editor.setTextAlign("left");
        break;
      case "alignCenter":
        state.editor.setTextAlign("center");
        break;
      case "alignRight":
        state.editor.setTextAlign("right");
        break;
      case "alignJustify":
        state.editor.setTextAlign("justify");
        break;
      case "heading1":
        state.editor.toggleHeading(1);
        break;
      case "heading2":
        state.editor.toggleHeading(2);
        break;
      case "heading3":
        state.editor.toggleHeading(3);
        break;
      case "bulletList":
        state.editor.toggleBulletList();
        break;
      case "orderedList":
        state.editor.toggleOrderedList();
        break;
      case "undo":
        state.editor.undo();
        break;
      case "redo":
        state.editor.redo();
        break;
      case "highlight":
        state.editor.toggleHighlight("#FFEB3B");
        break;
      case "superscript":
        state.editor.toggleSuperscript();
        break;
      case "subscript":
        state.editor.toggleSubscript();
        break;
      case "clearFormatting":
        state.editor.clearFormatting();
        break;
      case "horizontalRule":
        state.editor.setHorizontalRule();
        break;
    }

    updateToolbarState();
  });
}

function updateToolbarState(): void {
  if (!state.editor) return;

  const buttons = elements.toolbar.querySelectorAll(".toolbar-btn");
  buttons.forEach((btn) => {
    const command = (btn as HTMLElement).dataset.command;
    if (!command) return;

    let isActive = false;
    switch (command) {
      case "bold":
        isActive = state.editor!.isBoldActive();
        break;
      case "italic":
        isActive = state.editor!.isItalicActive();
        break;
      case "underline":
        isActive = state.editor!.isUnderlineActive();
        break;
      case "strike":
        isActive = state.editor!.isStrikeActive();
        break;
      case "heading1":
        isActive = state.editor!.isHeadingActive(1);
        break;
      case "heading2":
        isActive = state.editor!.isHeadingActive(2);
        break;
      case "heading3":
        isActive = state.editor!.isHeadingActive(3);
        break;
      case "bulletList":
        isActive = state.editor!.isBulletListActive();
        break;
      case "orderedList":
        isActive = state.editor!.isOrderedListActive();
        break;
      case "alignLeft":
        isActive = state.editor!.isActive({ textAlign: "left" });
        break;
      case "alignCenter":
        isActive = state.editor!.isActive({ textAlign: "center" });
        break;
      case "alignRight":
        isActive = state.editor!.isActive({ textAlign: "right" });
        break;
      case "alignJustify":
        isActive = state.editor!.isActive({ textAlign: "justify" });
        break;
      case "highlight":
        isActive = state.editor!.isHighlightActive();
        break;
      case "superscript":
        isActive = state.editor!.isSuperscriptActive();
        break;
      case "subscript":
        isActive = state.editor!.isSubscriptActive();
        break;
    }

    btn.classList.toggle("active", isActive);
  });
}

// ============ Voice Input ============

function setupVoiceInput(): void {
  state.voiceInput = new VoiceInput({
    onResult: (text, isFinal) => {
      if (isFinal && state.editor) {
        state.editor.insertText(text + " ");
        markDirty();
        updateWordCount();
      }
    },
    onStart: () => {
      elements.btnVoice.classList.add("recording");
      updateStatus("Listening...");
    },
    onEnd: () => {
      elements.btnVoice.classList.remove("recording");
      updateStatus(state.isDirty ? "Unsaved changes" : "Ready");
    },
    onError: (error) => {
      elements.btnVoice.classList.remove("recording");
      updateStatus(`Voice error: ${error}`, "error");
    },
  });

  // Disable button if not supported
  if (!state.voiceInput.isSupported()) {
    elements.btnVoice.disabled = true;
    elements.btnVoice.title = "Voice input not supported in this browser";
    elements.btnVoice.style.opacity = "0.5";
    elements.btnVoice.style.cursor = "not-allowed";
  }
}

function toggleVoiceInput(): void {
  if (state.voiceInput) {
    state.voiceInput.toggle();
  }
}

// ============ Event Handlers ============

function setupEventHandlers(): void {
  // Save button
  elements.btnSave.addEventListener("click", () => saveDocument(false));

  // New document button
  // New document button
  elements.btnNew.addEventListener("click", () => {
    createNewDocument();
    if (window.innerWidth <= 768) {
      toggleSidebar(false);
    }
  });

  // Export button
  elements.btnExport.addEventListener("click", exportPdf);

  // Focus editor when clicking on the container (padding area)
  elements.editorEl.addEventListener("click", (e) => {
    // Only focus if clicking the container directly (not the content)
    if (e.target === elements.editorEl) {
      state.editor?.focus();
    }
  });

  // Voice button - only one handler here
  elements.btnVoice.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleVoiceInput();
  });

  // Delete button (if exists)
  if (elements.btnDelete) {
    elements.btnDelete.addEventListener("click", deleteCurrentDocument);
  }

  // Page size selector
  if (elements.pageSize) {
    elements.pageSize.addEventListener("change", () => {
      const size = elements.pageSize.value;
      // Remove all page size classes
      elements.editorEl.classList.remove(
        "page-a4",
        "page-letter",
        "page-legal",
        "page-a5",
      );
      // Add the selected one
      elements.editorEl.classList.add(`page-${size}`);
    });
  }

  // Line spacing selector
  if (elements.lineSpacing) {
    elements.lineSpacing.addEventListener("change", () => {
      const spacing = elements.lineSpacing.value;
      // Update the editor's line-height dynamically
      const proseMirror = elements.editorEl.querySelector(
        ".ProseMirror",
      ) as HTMLElement;
      if (proseMirror) {
        proseMirror.style.lineHeight = spacing;
      }
    });
  }

  // Font family selector
  if (elements.fontFamily) {
    elements.fontFamily.addEventListener("change", () => {
      const font = elements.fontFamily.value;
      if (state.editor) {
        state.editor.setFontFamily(font);
      }
    });
  }

  // Font size selector
  if (elements.fontSize) {
    elements.fontSize.addEventListener("change", () => {
      const size = elements.fontSize.value;
      if (state.editor) {
        state.editor.setFontSize(size);
      }
    });
  }

  // Title input
  elements.docTitle.addEventListener("input", markDirty);

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // Ctrl+S to save
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault();
      saveDocument();
    }

    // Ctrl+N for new document
    if (e.ctrlKey && e.key === "n") {
      e.preventDefault();
      createNewDocument();
    }

    // Ctrl+E for export
    if (e.ctrlKey && e.key === "e") {
      e.preventDefault();
      exportPdf();
    }

    // Delete key when focused on title with a document open
    if (e.key === "Delete" && e.ctrlKey && state.currentDocId) {
      e.preventDefault();
      deleteCurrentDocument();
    }
  });

  // Warn before leaving with unsaved changes
  window.addEventListener("beforeunload", (e) => {
    if (state.isDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  // Mobile Menu Handlers
  if (elements.btnMenu) {
    elements.btnMenu.addEventListener("click", () => toggleSidebar());
  }

  if (elements.sidebarOverlay) {
    elements.sidebarOverlay.addEventListener("click", () =>
      toggleSidebar(false),
    );
  }
}

// ============ Initialize Application ============

async function init(): Promise<void> {
  console.log("[Smart Office] Initializing...");

  let lastWordCountUpdate = 0;

  // Initialize TipTap editor
  state.editor = new DocumentEditor({
    element: elements.editorEl,
    placeholder: "Start typing or use voice input...",
    onUpdate: () => {
      markDirty();

      // Throttle word count updates (FE-004)
      const now = Date.now();
      if (now - lastWordCountUpdate > 500) {
        updateWordCount();
        lastWordCountUpdate = now;
      }

      updateToolbarState();
    },
  });

  // Setup UI handlers
  setupToolbar();
  setupVoiceInput();
  setupEventHandlers();

  // Initial UI state
  updateDeleteButton();

  // Load initial data
  await Promise.all([loadDocuments(), loadTemplates()]);

  // Check for unsaved draft from previous session
  const draft = loadDraft();
  if (draft) {
    const ageMs = Date.now() - draft.timestamp;
    const ageMinutes = Math.floor(ageMs / 60000);
    const ageDisplay =
      ageMinutes < 1
        ? "less than a minute"
        : ageMinutes === 1
          ? "1 minute"
          : `${ageMinutes} minutes`;

    const restore = window.confirm(
      `You have an unsaved draft from ${ageDisplay} ago.\n\n` +
        `Title: "${draft.title}"\n\n` +
        "Would you like to restore it?",
    );

    if (restore) {
      elements.docTitle.value = draft.title;
      if (state.editor && isValidTipTapContent(draft.content)) {
        state.editor.setContent(draft.content);
      }
      state.isDirty = true;
      updateStatus("Draft restored - remember to save!");
      updateWordCount();
      console.log("[Smart Office] Draft restored from localStorage");
    } else {
      clearDraft();
      console.log("[Smart Office] Draft discarded");
    }
  }

  updateStatus("Ready");
  updateWordCount();
  console.log("[Smart Office] Ready!");

  // Focus editor
  state.editor.focus();
}

// Start application
init().catch(console.error);
