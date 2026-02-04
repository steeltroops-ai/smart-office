// Smart Office - Main Application Entry
// Integrates TipTap editor, API client, and UI

import { DocumentEditor } from "./editor";
import {
  documentApi,
  templateApi,
  type DocumentSummary,
  type Template,
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

  // Auto-save logic
  // Only auto-save if we have a valid Doc ID (don't create new files automatically)
  if (state.currentDocId) {
    if (state.autoSaveTimer) clearTimeout(state.autoSaveTimer);

    // Debounce save for 2 seconds
    state.autoSaveTimer = setTimeout(() => {
      saveDocument(true); // true = silent/auto save
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
      if (id) loadDocument(id);
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
      if (id) loadTemplate(id);
    });
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
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
  // Check for unsaved changes
  if (state.isDirty) {
    const confirmDiscard = window.confirm(
      "You have unsaved changes. Discard them?",
    );
    if (!confirmDiscard) return;
  }

  setLoading(true);
  updateStatus("Loading...", "saving");

  try {
    const doc = await documentApi.get(id);
    if (doc) {
      state.currentDocId = doc.id;
      elements.docTitle.value = doc.title;

      if (state.editor && doc.content) {
        state.editor.setContent(doc.content);
      }

      state.isDirty = false;
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
  // Check for unsaved changes
  if (state.isDirty) {
    const confirmDiscard = window.confirm(
      "You have unsaved changes. Discard them?",
    );
    if (!confirmDiscard) return;
  }

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

async function saveDocument(isAutoSave = false): Promise<void> {
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

  const finalTitle = title || "Untitled Document";

  try {
    let doc;
    if (state.currentDocId) {
      doc = await documentApi.update(state.currentDocId, {
        title: finalTitle,
        content,
      });
    } else {
      doc = await documentApi.create({ title: finalTitle, content });
    }

    if (doc) {
      state.currentDocId = doc.id;
      state.isDirty = false;
      updateStatus("Saved", "saved");
      updateDeleteButton();
      await loadDocuments();
    } else {
      updateStatus("Save failed", "error");
    }
  } catch (error) {
    console.error("Save error:", error);
    updateStatus("Save failed", "error");
  } finally {
    state.isSaving = false;
    if (!isAutoSave) setLoading(false);
  }
}

async function createNewDocument(): Promise<void> {
  // Check for unsaved changes
  if (state.isDirty) {
    const confirmDiscard = window.confirm(
      "You have unsaved changes. Discard them?",
    );
    if (!confirmDiscard) return;
  }

  state.currentDocId = null;
  elements.docTitle.value = "";
  state.editor?.clear();
  state.isDirty = false;
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

async function exportPdf(): Promise<void> {
  if (!state.editor) return;

  // 1. Validation: Check if empty
  if (state.editor.getCharacterCount() === 0) {
    alert("Cannot export an empty document. Please add some text first.");
    return;
  }

  // 2. Validation: Ensure saved (optional, but good practice per user request)
  if (state.isDirty) {
    const confirm = window.confirm(
      "You have unsaved changes. Save before exporting to ensure latest version?",
    );
    if (confirm) {
      await saveDocument();
    }
  }

  setLoading(true);
  updateStatus("Generating PDF...", "saving");

  try {
    const { jsPDF } = await import("jspdf");

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const title = elements.docTitle.value || "Untitled Document";
    const content = state.editor.getJSON(); // Get structure, not just text

    // Document setup
    let y = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    const pageHeight = doc.internal.pageSize.getHeight();

    // Helper to check page break
    const checkPageBreak = (heightNeeded: number) => {
      if (y + heightNeeded > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    };

    // Render Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text(title, margin, y);
    y += 15;

    // Render Content Nodes
    // Note: This is a simplified renderer for POC.
    // It handles Headings and Paragraphs.

    // cast content to any to access content array
    const nodes = (content as any).content || [];

    doc.setFont("helvetica", "normal");

    nodes.forEach((node: any) => {
      let fontSize = 12;
      let fontStyle = "normal";
      let lineHeight = 7;
      let spacingAfter = 7;

      // Detect styles based on node type
      if (node.type === "heading") {
        fontStyle = "bold";
        if (node.attrs?.level === 1) {
          fontSize = 18;
          lineHeight = 10;
          spacingAfter = 10;
        } else if (node.attrs?.level === 2) {
          fontSize = 16;
          lineHeight = 9;
          spacingAfter = 8;
        } else {
          fontSize = 14;
          lineHeight = 8;
          spacingAfter = 8;
        }
      } else if (node.type === "paragraph") {
        fontSize = 12;
        fontStyle = "normal";
        lineHeight = 6;
        spacingAfter = 6;
      }

      // Set styles
      doc.setFont("helvetica", fontStyle);
      doc.setFontSize(fontSize);

      // Get text content
      let text = "";
      if (node.content) {
        text = node.content.map((c: any) => c.text).join("");
      }

      // Skip empty paragraphs unless explicitly needed
      if (!text && node.type === "paragraph") {
        y += lineHeight; // Small gap for empty line
        return;
      }

      // Basic Word Wrap
      const lines = doc.splitTextToSize(text, maxWidth);

      checkPageBreak(lines.length * lineHeight + spacingAfter);

      doc.text(lines, margin, y);
      y += lines.length * lineHeight + spacingAfter;
    });

    // Save the PDF
    const filename = `${title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
    doc.save(filename);

    updateStatus("PDF exported", "saved");
  } catch (error) {
    console.error("PDF export error:", error);
    updateStatus("PDF export failed", "error");
  } finally {
    setLoading(false);
  }
}

// ============ Toolbar Handling ============

function setupToolbar(): void {
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
  elements.btnNew.addEventListener("click", createNewDocument);

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
}

// ============ Initialize Application ============

async function init(): Promise<void> {
  console.log("[Smart Office] Initializing...");

  // Initialize TipTap editor
  state.editor = new DocumentEditor({
    element: elements.editorEl,
    placeholder: "Start typing or use voice input...",
    onUpdate: () => {
      markDirty();
      updateWordCount();
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

  updateStatus("Ready");
  updateWordCount();
  console.log("[Smart Office] Ready!");

  // Focus editor
  state.editor.focus();
}

// Start application
init().catch(console.error);
