# Smart Office

Offline document editor that runs on a local network. No cloud, no internet, no external dependencies.

## What Is This?

A browser-based document editor (like Google Docs) that runs entirely on your own server. Built for offices that can't use cloud tools due to security policies.

## Quick Start

```bash
# You need Bun installed (https://bun.sh)
bun install
bun run dev
```

Open http://localhost:3000

## Features

- **Rich text editing** - Bold, italic, headings, lists, alignment
- **Font controls** - Family (Arial, Calibri, etc.) and size (8-72px)
- **Templates** - Pre-made document formats (letters, memos)
- **Voice dictation** - Click mic, speak, text appears (Chrome/Edge)
- **PDF export** - Download as PDF
- **Auto-save** - Saves after you stop typing

## How It Works

```
Browser <---> Bun Server <---> JSON Files
```

That's it. Server serves the editor and handles document storage. Documents are JSON files in the `data/` folder.

## Project Structure

```
src/
  client/       # Frontend (HTML, CSS, TypeScript)
  server/       # Backend (Hono API routes)
templates/      # Document templates
data/           # Saved documents (git-ignored)
docs/           # Design documentation
```

## API

| Method | Endpoint | What it does |
|--------|----------|--------------|
| GET | /api/documents | List all documents |
| POST | /api/documents | Create document |
| GET | /api/documents/:id | Get one document |
| PUT | /api/documents/:id | Update document |
| DELETE | /api/documents/:id | Delete document |
| GET | /api/templates | List templates |
| GET | /api/templates/:id | Get template |

## Tech Stack

- **Runtime**: Bun (could swap for Node.js)
- **Server**: Hono (Express-like, smaller)
- **Editor**: TipTap (headless, JSON-based)
- **Storage**: JSON files (would move to SQLite for production)

## Known Limitations

1. **Voice only works in Chrome/Edge** - Firefox doesn't support offline speech recognition
2. **No multi-user** - One person editing at a time, no locking
3. **PDF is basic** - Complex formatting might not render perfectly
4. **No search** - Would need a database for that
5. **No tests** - Time constraints

## What I'd Improve

If I had more time:

1. Add SQLite for better performance with many documents
2. Document locking so two people don't overwrite each other
3. Version history (undo across sessions)
4. Better PDF export using Puppeteer
5. Actual test coverage

## Documentation

| Document | Description |
|----------|-------------|
| [DESIGN_NOTES.md](./DESIGN_NOTES.md) | Main design document - technology choices, trade-offs, production considerations |
| [PROBLEM_STATEMENT.md](./PROBLEM_STATEMENT.md) | Original requirements and evaluation criteria |
| [docs/01-design-and-approach.md](./docs/01-design-and-approach.md) | Detailed system architecture and component design |
| [docs/02-poc-software-design.md](./docs/02-poc-software-design.md) | POC implementation plan and code patterns |


## Running in Production

```bash
bun run start
```

For multi-device access, other machines on the network can use:
```
http://<your-ip>:3000
```

## License

Built as a technical assessment.
