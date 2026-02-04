# Hiring Problem Statement – Smart Office

## Background
Organizations that operate in secure or offline environments still rely heavily on manual document creation and clerical workflows. Documents are often created by copying old templates, manually formatting content, and passing drafts through multiple people for review and approval.

This process is:
- Time-consuming and repetitive
- Error-prone (formatting, missing sections)
- Hard to standardize across teams
- Risky from a confidentiality perspective

We are building Smart Office, an offline, browser-based document creation and editing system that:
- Runs entirely on-prem / offline
- Allows users to create and edit documents in the browser (Google Docs–like)
- Supports voice input (speech-to-text)
- Uses templates to standardize documents
- Can be deployed as a Node Server + browser clients over LAN

This is not a SaaS product and does not rely on the internet.

## Your Task
You are not expected to build the full product.
We want to understand:
- How you think
- How you design systems
- How you trade off simplicity vs scalability
- How you approach offline-first, real-world products

## Part 1 – Design & Approach (Mandatory)
Please write a short design note answering:

### 1. System Design
How would you design a system that:
- Runs entirely offline
- Allows full document editing in the browser with voice based prompts
- Saves documents locally via a server
- Supports multiple users on a LAN

You may include:
- High-level architecture diagram (optional)
- Choice of frontend and backend technologies
- How browser and server communicate

### 2. Document Editing
How would you implement:
- A Word/Google Docs–like editor in the browser
- Saving and loading documents
- Applying formatting (bold, headings, tables, move sender’s address from right to left, receiver block, subject, edits)

What editor or approach would you choose and why?

### 3. Voice Input (Speech-to-Text)
How would you add voice dictation such that:
- It works offline
- Transcribed text appears inside the document editor

You don’t need to implement speech recognition fully, but explain:
- Where it runs (browser or server)
- How audio flows through the system
- How text gets inserted into the document

### 4. Templates & Standardization
How would you support:
- Creating documents from templates
- Editing templates
- Ensuring documents follow a standard format

What would you store as templates and in what format?

### 5. Key Trade-offs
Please explicitly mention:
- What you would not build in v1
- What technical shortcuts you would avoid
- Where you expect future complexity

## Part 2 – Short POC (Choose One)
Build one small proof of concept.
It does not need to be production-ready.

### Option A – Full-Stack POC (Preferred)
Build a minimal system that:
- Runs a local Node.js server
- Serves a browser-based text editor
- Allows:
  - Creating a document
  - Editing text
  - Saving and loading the document from the server

**Bonus (optional):**
- Export the document as a PDF or DOCX
- Add a simple “template” button that pre-fills content

### Option B – Frontend-Focused POC
Build a browser-based editor that:
- Supports rich text (headings, bold, lists)
- Has a “Load Template” button
- Has a “Save” button (can save to localStorage or mock API)

Explain how you would connect this to a backend in a real system.

### Option C – Backend-Focused POC
Build a Node.js server that:
- Accepts document content via API
- Saves it locally (file or SQLite)
- Returns saved documents on request

Explain how a browser editor would interact with it.

## What We Evaluate
We are not judging you on polish.
We are evaluating:
- System thinking
- Offline-first mindset
- Clarity of decisions
- Code readability
- Practical trade-offs
- Ability to explain why you chose something

## Deliverables
- GitHub repository or ZIP
- README explaining:
  - How to run
  - Design decisions
  - What you would improve next
- Video walkthrough of the platform

## Bonus (Optional, Not Required)
- How would you scale this to multiple users?
- How would you add approvals and document locking?
- How would you add AI later without breaking determinism?

## Final Note to Candidates
This is a real product problem, not a puzzle.
There is no single “correct” answer.
We are more interested in how you think than how much you build. Give your own solution and not something we could have already asked ChatGPT.

**Deadline: 24 hours**
