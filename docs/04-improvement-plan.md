# Error Handling & Feature Improvement Plan

## 1. Auto-Save Implementation
**Current State:**
- `markDirty()` sets a flag but doesn't trigger save.
- User must manually click Save or use Ctrl+S.

**Solution:**
- Implement a debounce timer (2000ms) in `markDirty()`.
- If no typing occurs for 2 seconds, trigger `saveDocument()` automatically.
- Update UI to show "Saving..." -> "All changes saved".
- **Edge Case:** Don't auto-save if it's a "New Document" (no ID yet) to avoid cluttering the server with "Untitled" drafts until the user explicitly saves once.

## 2. PDF Export Improvements
**Current State:**
- Exports plain text (`editor.getText()`) via jsPDF.
- Loss of all formatting (bold, headers, lists).
- Allows exporting empty files.

**Solution:**
- **Validation:** Block export if document is empty (`editor.getCharacterCount() === 0`). Show alert: "Cannot export empty document."
- **Formatting:** Instead of `doc.text(rawText)`, traverse the TipTap JSON:
    - `heading`: Set font size 16/14, Bold.
    - `paragraph`: Set font size 12.
    - `bulletList`: Indent and add bullets.
    - `bold` mark: Switch font to Bold.
- **Workflow:** Ensure document is saved before export (or at least warn).

## 3. Empty State & Error Handling
**Current State:**
- Can save empty documents.
- Basic alerts for errors.

**Solution:**
- **Save Validation:** Prevent saving if title is empty (default to "Untitled") or content is effectively empty.
- **Dirty State Handling:** When opening a new file with unsaved changes, prompt better options (Save & Open vs Discard).

## 4. Delete Logic
**Current State:**
- Confirms, then deletes.

**Solution:**
- Keep as is, but ensure editor state is cleared properly if the *active* document is deleted. (Already implemented in `main.ts`, will verify).

---

## implementation Strategy

1. **Auto-Save:** Modify `src/client/js/main.ts` to add debounce logic.
2. **PDF Logic:** rewrite `exportPdf` in `src/client/js/main.ts` to use a custom JSON-to-PDF renderer.
3. **UX Polish:** Add toast/status messages for these actions.
