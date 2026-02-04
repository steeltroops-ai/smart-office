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

I kept it simple. One server serves both the API and the frontend. Clients connect over LAN.

```
[Browser 1] ----+
[Browser 2] ----+---> [Bun Server :3000] ---> [JSON Files]
[Browser 3] ----+
```

No database for the POC. Documents are just JSON files in a folder. Easy to debug, easy to backup (just copy the folder).

**For production with 100+ users**, I'd evolve this:

```
[Browsers] ---> [nginx] ---> [App Server 1] ---> [PostgreSQL]
                         |-> [App Server 2] ---> [Redis for locks]
                         |-> [App Server 3]
```

Why Postgres over SQLite? SQLite is single-writer. When 50 people save simultaneously, you get lock contention. Postgres handles concurrent writes properly.

Why Redis? For document locking. When user A opens a doc, Redis stores `{doc_id: user_a, expires: 30min}`. User B tries to open it, sees it's locked, gets notified when it's free.

### Why These Technologies?

**Bun instead of Node.js**

Honestly, both would work. I picked Bun because:
- Runs TypeScript directly (no build step for server)
- Has a bundler built in (no webpack config)
- Fast startup helps during development

The downside is it's newer, so Stack Overflow has fewer answers. For production, switching to Node.js would be straightforward since the code is the same.

**TipTap for the Editor**

I looked at Quill first because it's popular, but it stores documents in a format called "Delta" which is basically a list of operations. TipTap stores everything as JSON that looks like the actual document structure. This meant:
- Saving = `JSON.stringify(editor.getJSON())`
- Loading = `editor.setContent(JSON.parse(savedData))`

No conversion layer needed. That's why I went with TipTap.

Also considered: CKEditor (too heavy, 500KB+), Draft.js (abandoned by Facebook), ProseMirror directly (too low-level for a POC).

**Hono instead of Express**

Hono is basically Express but smaller (14kb vs 200kb). Doesn't matter much for a server-side app, but it has better TypeScript types and I'm more familiar with it.

**Vanilla CSS, no Tailwind**

For an offline-first app, I wanted minimal dependencies. One CSS file with CSS variables for theming. No build step, no utility class bloat.

---

## How I Tackled Each Requirement

### 1. Document Editing

TipTap gave me this out of the box. I added these extensions:
- StarterKit (bold, italic, lists, headings)
- TextAlign (left/center/right/justify)
- FontFamily and FontSize (dropdowns in toolbar)
- Underline, Highlight, Subscript, Superscript

The toolbar was hand-built with SVG icons. I wanted it to feel like Word/Google Docs so users don't have a learning curve.

**Formatting specifics:**

- Bold, headings, lists → StarterKit extension
- Sender address right-aligned → TextAlign extension with `textAlign: 'right'`
- Receiver block, subject line → Template structure enforces this
- Tables → Could add with TipTap Table extension (didn't include in POC)

### 2. Saving and Loading

Documents are stored as JSON files:

```
data/
  doc-xyz123.json
  doc-abc456.json
```

Each file looks like:
```json
{
  "id": "doc-xyz123",
  "title": "Meeting Notes",
  "content": { /* TipTap JSON */ },
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

**For production**, I'd add:
- `version` field for conflict detection
- `lockedBy` and `lockedAt` for pessimistic locking
- `createdBy` for audit trail

Before saving: check your version matches server. If mismatch, someone else saved while you had it open → show diff, let user merge.

### 3. Voice Input

This was the interesting part. The requirement was offline voice dictation.

**Where it runs:** Browser. Not server.

**Why browser?** Chrome and Edge ship with offline speech models. No setup, no model download, just works.

```javascript
const recognition = new webkitSpeechRecognition();
recognition.continuous = true;
recognition.interimResults = true;

recognition.onresult = (event) => {
  const result = event.results[event.results.length - 1];
  if (result.isFinal) {
    editor.insertContent(result[0].transcript + ' ');
  }
};
```

**Audio flow:**
1. User clicks mic button → `recognition.start()`
2. Browser captures audio from microphone
3. Browser's speech engine processes locally
4. `onresult` fires with partial/final text
5. Final text inserted at cursor position

**Limitation:** Firefox doesn't support offline speech. Would need server-side Whisper as fallback.

**For production with Whisper:**

```
Browser --[WebSocket: audio chunks]--> Server
Server --[forward]--> Whisper (Python sidecar)
Whisper --[text]--> Server --[WebSocket]--> Browser --[insert]
```

Model sizes: tiny (75MB, 70% accuracy), base (142MB, 85%), small (466MB, 92%). I'd deploy `base` by default.

### 4. Templates

Templates are just pre-made documents stored as JSON:

```
templates/
  blank.json
  official-letter.json
  memo.json
  notice.json
```

**Template format:**
```json
{
  "id": "official-letter",
  "name": "Official Letter",
  "content": {
    "type": "doc",
    "content": [
      {"type": "paragraph", "attrs": {"textAlign": "right"}, 
       "content": [{"type": "text", "text": "[Sender Name]"}]},
      {"type": "paragraph", "attrs": {"textAlign": "right"},
       "content": [{"type": "text", "text": "[Date]"}]}
    ]
  }
}
```

When you click a template, it loads the content into the editor. You can then edit and save as a new document.

**For production, templates would need:**

1. **Variable substitution**: `{{TODAY}}`, `{{CURRENT_USER}}`
2. **Versioning**: Old docs keep working with old template version
3. **Validation**: Required sections must exist before export
4. **Admin editor**: UI to create/edit templates (not just JSON files)

**Ensuring documents follow standard format:**

I'd add schema validation:
```typescript
function validate(doc, template) {
  const missing = template.requiredSections.filter(
    s => !doc.hasSection(s)
  );
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

| Feature | Why I Skipped | When to Add |
|---------|--------------|-------------|
| User authentication | Not needed for POC demo | When deploying to real office |
| Real-time collaboration | Locking is simpler, fits gov use case | If they specifically request it |
| Document versioning | Adds DB complexity | Phase 2, with SQLite migration |
| Full-text search | Needs database indexing | When doc count > 500 |
| DOCX export | PDF is sufficient | If Word compatibility needed |

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

## How I'd Handle Multi-User!?
Government offices don't need Google Docs-style real-time collaboration. They want **locking**: one person edits, others wait.

```typescript
async function openDocument(docId, userId) {
  const lock = await redis.get(`lock:${docId}`);
  
  if (lock && lock.userId !== userId) {
    return { error: `Locked by ${lock.userName}`, until: lock.expiresAt };
  }
  
  await redis.setex(`lock:${docId}`, 1800, JSON.stringify({
    userId, userName: getUser(userId).name,
    expiresAt: Date.now() + 30 * 60 * 1000
  }));
  
  return { doc: await db.get(docId), locked: true };
}
```

Lock expires after 30 minutes of inactivity. On `beforeunload`, release lock early.

---

## How I'd Add Approvals!?

State machine:

```
Draft → Submitted → Under Review → Approved → Published
                  ↘ Rejected → Draft
```

```typescript
const workflow = {
  DRAFT:        { next: ['SUBMITTED'], role: 'author' },
  SUBMITTED:    { next: ['UNDER_REVIEW', 'DRAFT'], role: 'reviewer' },
  UNDER_REVIEW: { next: ['APPROVED', 'REJECTED'], role: 'approver' },
  APPROVED:     { next: ['PUBLISHED'], role: 'publisher' }
};
```

Each transition logs who did what when. Document is locked during review stages.

---

## How I'd Add AI!?
The constraint is offline + deterministic. AI can still help:

**Local models only**:
- Grammar: LanguageTool (runs locally, Java)
- Spelling: Hunspell
- Suggestions: Small model like Phi-2 (2.7B params, runs on CPU)

**Suggestions, not auto-changes**:
```typescript
const suggestions = await grammarCheck(doc);
showPanel(suggestions); // User clicks to apply
// Never: doc.content = ai.autoFix(doc)
```

**Deterministic outputs**:
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

Opens at http://localhost:3000

---

## File Structure

```
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

That's it. Simple system, works offline, does what it needs to do.
