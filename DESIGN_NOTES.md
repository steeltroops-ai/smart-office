# Smart Office - Design Notes

## What I Built

A browser-based document editor that works completely offline on a local network. Think Google Docs but running on your own server, no internet needed.

---

## The Problem (As I Understood It)

Government and secure offices can't use cloud tools like Google Docs or Notion because of data policies. They still use Word + email + USB drives to pass documents around. It's slow and messy.

The ask was: build something that gives them a modern editing experience but runs entirely on-prem.

---

## My Approach

### System Architecture

#### Single Server (Monolith)

```text
[Clients] <---> [Bun Server] <---> [SQLite (WAL Mode)]
```

- **Choice:** **SQLite (WAL Mode)**
- **Rejected:** JSON Files (fs)
- **Why:** JSON files suffer from race conditions (last-write-wins). SQLite WAL provides atomic commits and safe concurrency without the overhead of Postgres.

#### For Scale (100+ Users)

- **Choice:** PostgreSQL + Redis
- **Why:** SQLite has a single writer lock. Postgres handles concurrent writes. Redis manages ephemeral distributed locks.

### Critical Tech Stack Decisions

#### Runtime

- **Choice:** **Bun**
- **Rejected:** Node.js
- **Why:** Native TypeScript support (no `tsc` build step), 4x faster startup, and built-in SQLite driver. Reduces "Download Internet" fatigue on offline networks.

#### Editor Engine

- **Choice:** **TipTap (ProseMirror)**
- **Rejected:** Quill / CKEditor / HTML5 ContentEditable
- **Why:** It separates Model (JSON) from View (DOM).
  - _Depth:_ Storing HTML is brittle. Storing JSON State allows deterministic rendering (e.g. to PDF or Mobile) without parsing messy DOM strings.

#### API Framework

- **Choice:** **Hono**
- **Rejected:** Express
- **Why:** Type-safe Router. 10x smaller. Shared types with client means if I change the API response, the Frontend build fails immediately.

#### Styling

- **Choice:** **Vanilla CSS**
- **Rejected:** Tailwind / Bootstrap
- **Why:** Offline-first requirement. No build pipeline needed. One `.css` file is easier to debug in a browser console than 50 utility classes.

---

## How I Tackled Each Requirement

### 1. Document Editing

TipTap gave me this out of the box. I added these extensions:

- StarterKit (bold, italic, lists, headings)
- TextAlign (left/center/right/justify)
- FontFamily and FontSize (dropdowns in toolbar)
- Underline, Highlight, Subscript, Superscript

The toolbar was hand-built with SVG icons. I wanted it to feel like Word/Google Docs so users don't have a learning curve.

#### Formatting specifics

- Bold, headings, lists → StarterKit extension
- Sender address right-aligned → TextAlign extension with `textAlign: 'right'`
- Receiver block, subject line → Template structure enforces this
- Tables → Could add with TipTap Table extension (didn't include in POC)

### 2. Saving and Loading

Documents are stored as JSON files:

```text
data/
  doc-xyz123.json
  doc-abc456.json
```

Each file looks like:

```json
{
  "id": "doc-xyz123",
  "title": "Meeting Notes",
  "content": {
    /* TipTap JSON */
  },
  "createdAt": "2024-02-05T10:00:00Z",
  "updatedAt": "2024-02-05T10:30:00Z",
  "version": 1
}
```

The API is simple REST:

- `GET /api/documents` - list all
- `POST /api/documents` - create
- `PUT /api/documents/:id` - update
- `DELETE /api/documents/:id` - delete

Auto-save triggers 2 seconds after you stop typing. The UI shows "Saving..." and "Saved" so you know it worked.

#### For production, I'd add

- `version` field for conflict detection
- `lockedBy` and `lockedAt` for pessimistic locking
- `createdBy` for audit trail

Before saving: check your version matches server. If mismatch, someone else saved while you had it open → show diff, let user merge.

### 3. Voice Input (Architecture)

#### The Challenge

"Offline" usually implies privacy and zero-cloud.

- **Choice (V2 Enterprise):** **Local Whisper (Server-side)**
- **Rejected:** Web Speech API (Browser)
- **Why:**
  - _Privacy:_ Browser APIs often silently send audio to Cloud (Google/Apple) for processing. Unacceptable for Secure Gov.
  - _Consistency:_ Works on Firefox/Safari (which lack offline dictation).

#### The Flow

1. **Capture:** MediaRecorder API captures raw PCM chunks.
2. **Stream:** WebSocket pushes chunks to Server.
3. **Process:** Server runs `Whisper.cpp` (WASM/C++) on audio buffer.
4. **Insert:** Text stream pushed back to Editor cursor.

_(Note: V1 POC uses Web Speech API purely for demo ease, but the design mandates Whisper)._

### 4. Templates

Templates are just pre-made documents stored as JSON:

```text
templates/
  blank.json
  official-letter.json
  memo.json
  notice.json
```

#### Template format

```json
{
  "id": "official-letter",
  "name": "Official Letter",
  "content": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "attrs": { "textAlign": "right" },
        "content": [{ "type": "text", "text": "[Sender Name]" }]
      },
      {
        "type": "paragraph",
        "attrs": { "textAlign": "right" },
        "content": [{ "type": "text", "text": "[Date]" }]
      }
    ]
  }
}
```

When you click a template, it loads the content into the editor. You can then edit and save as a new document.

#### For production, templates would need

1. **Variable substitution**: `{{TODAY}}`, `{{CURRENT_USER}}`
2. **Versioning**: Old docs keep working with old template version
3. **Validation**: Required sections must exist before export
4. **Admin editor**: UI to create/edit templates (not just JSON files)

#### Ensuring documents follow standard format

I'd add schema validation:

```typescript
function validate(doc, template) {
  const missing = template.requiredSections.filter((s) => !doc.hasSection(s));
  return missing.length === 0;
}
```

Can't export until all required sections are filled.

### 5. PDF Export

Used jsPDF which runs entirely in the browser. Click export, it generates a PDF and downloads it.

The quality is... okay. Basic text and formatting works. Tables and complex layouts would need something more sophisticated like Puppeteer (headless Chrome) on the server. But for the POC, jsPDF was good enough and required zero server dependencies.

---

## Trade-offs I Made

### What I Didn't Build (and Why)

| Feature                 | Why I Skipped                         | When to Add                     |
| :---------------------- | :------------------------------------ | :------------------------------ |
| User authentication     | Basic Identity (Header) added         | Needed for Locking/Auditing     |
| Real-time collaboration | Locking is simpler, fits gov use case | If they specifically request it |
| Document versioning     | Adds DB complexity                    | Phase 2, with SQLite migration  |
| Full-text search        | Needs database indexing               | When doc count > 500            |
| DOCX export             | PDF is sufficient                     | If Word compatibility needed    |

### Where I Took Shortcuts

1. **No input validation**: The server trusts whatever the client sends. In production, I'd validate document structure with Zod or similar.

2. **No error boundaries**: If the API fails, the UI just shows nothing. Should add proper error states.

3. **No tests**: Zero test coverage. I'd add at least API route tests before shipping.

4. **Font size extension is pre-release**: `@tiptap/extension-font-size@3.0.0-next.3` - not stable yet. Might have bugs.

### Shortcuts I Avoided

- **localStorage as storage**: Size limits (5MB), no backup, no multi-device. Bad idea even for POC.
- **innerHTML for editor**: XSS risk, no structure. Would never do this.
- **Polling for updates**: Wastes bandwidth. WebSocket is the right choice.
- **Storing HTML directly**: Hard to validate, hard to migrate. JSON is better.

### What Would Break at Scale

- **100+ users**: File system can't handle concurrent writes. Need database.
- **1000+ documents**: Listing requires scanning all files. Need database + pagination.
- **Large documents**: No lazy loading. 50+ page doc might slow down.
- **Multiple offices**: Single server is SPOF. Need replication.

---

## How I'd Handle Multi-User!? (Concurrency)

### Strategy: Pessimistic Locking

- **Choice:** **Locking + Heartbeats**
- **Rejected:** Real-time (CRDT/Y.js)
- **Why:**
  - _Workflow:_ Government approval chains are sequential (Draft -> Review -> Approve), not collaborative brainstorming.
  - _Simplicity:_ CRDTs add massive complexity (vector clocks, tombstones). Locking is easy to audit.

### The Implementation

1. User A opens Doc: Server checks `locked_by`.
   - If null: Set `locked_by = A`, `expires = NOW + 30s`.
2. **Heartbeat:** Client A pings every 10s to extend lock.
3. User B opens Doc: Server sees lock. Returns `READ_ONLY` mode.
4. **FailSafe:** If A closes tab (no ping), lock expires in 30s. No admin intervention needed.

---

## How I'd Add Approvals!?

State machine:

```text
Draft → Submitted → Under Review → Approved → Published
                  ↘ Rejected → Draft
```

```typescript
const workflow = {
  DRAFT: { next: ["SUBMITTED"], role: "author" },
  SUBMITTED: { next: ["UNDER_REVIEW", "DRAFT"], role: "reviewer" },
  UNDER_REVIEW: { next: ["APPROVED", "REJECTED"], role: "approver" },
  APPROVED: { next: ["PUBLISHED"], role: "publisher" },
};
```

Each transition logs who did what when. Document is locked during review stages.

---

## How I'd Add AI!?

The constraint is offline + deterministic. AI can still help:

### Local models only

- Grammar: LanguageTool (runs locally, Java)
- Spelling: Hunspell
- Suggestions: Small model like Phi-2 (2.7B params, runs on CPU)

### Suggestions, not auto-changes

```typescript
const suggestions = await grammarCheck(doc);
showPanel(suggestions); // User clicks to apply
// Never: doc.content = ai.autoFix(doc)
```

### Deterministic outputs

```typescript
const result = model.generate(text, { temperature: 0, seed: docId });
// Same input = same output, every time
```

---

## If I Had More Time

1. **SQLite migration**: Same schema, better concurrency
2. **Document locking**: Don't let two people edit same doc
3. **Version history**: Keep last 10 versions, allow restore
4. **Better PDF**: Puppeteer for pixel-perfect exports
5. **Whisper fallback**: For Firefox users and better accuracy

---

## Running It

```bash
# Install
bun install

# Dev mode (watches for changes)
bun run dev

# Production
bun run start
```

Opens at <http://localhost:3000>

---

## File Structure

```text
smart-office/
  src/
    client/         # Frontend
      css/          # Styles
      js/           # TypeScript
      index.html    # Main page
    server/         # Backend
      routes/       # API endpoints
      services/     # Business logic
      index.ts      # Entry point
  templates/        # Document templates
  data/             # Saved documents
  docs/             # Design docs (you're reading one)
```

---

## Architectural Choices (Quick Summary)

- **Database: SQLite vs JSON Files**
  - **Choice:** SQLite (WAL Mode)
  - **Why:** JSON files corrupt data if 2 users save at once. SQLite is safe, atomic, and zero-config in Bun.

- **Voice: Local Whisper vs Web Speech API**
  - **Choice:** Local Whisper (Architecture)
  - **Why:** Web Speech API sends audio to Google Cloud. Whisper works 100% offline (Privacy/Compliance).

- **Auth: Basic Identity vs No Auth**
  - **Choice:** Header-based Identity (`X-User-ID`)
  - **Why:** "No Auth" is dangerous (anonymous deletions). We need to track who locked which document.

- **Locking: Heartbeat vs Hard Timeout**
  - **Choice:** Heartbeat (30s ping)
  - **Why:** Hard timeouts (e.g. 30min) block the whole team if a user crashes. Heartbeats release locks instantly when a user disconnects.

- **Runtime: Bun vs Node.js**
  - **Choice:** Bun
  - **Why:** Built-in TypeScript, SQLite, and 6x faster startup. Ideal for this self-contained POC.
