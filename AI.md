# AI Assistant Guidance & Context Entry Point

Welcome to the **Real Estate AI Calling CRM** codebase (`realestate-crm`). This file is the primary entry point for all AI coding assistants.

---

## 1. Golden Rules for AI Assistants

Before reading or touching any code in this repository, you **must adhere to these 10 principles**:

1. **Read `AI.md` First:** Understand the orientation, guidelines, and navigation rules before executing any task.
2. **Read Only Relevant `.ai/` Documentation:** Do not load all files blindly; inspect only the specific `.ai/` documents relevant to your current prompt.
3. **Inspect Actual Source Code Before Making Changes:** Documentation guides navigation, but the source code itself is the absolute source of truth. Always view source files before proposing or making edits.
4. **Never Assume Technologies or Architecture:** Do not infer packages, frameworks, cloud services, databases, or API patterns from general conventions. Only rely on evidence in the codebase.
5. **Reuse Existing Code Whenever Possible:** Check existing modules, helper services, and UI components before creating new abstractions or duplicate utilities.
6. **Make Minimal, Safe Changes:** Keep diffs focused, precise, and targeted directly at the user's objective.
7. **Avoid Unnecessary Dependencies and Refactoring:** Do not introduce new libraries or rewrite existing working code unless explicitly requested by the user.
8. **Do Not Break Existing Functionality:** Ensure backwards compatibility across the frontend UI, API routes, WebSocket audio streams, and database schemas.
9. **Never Expose Secrets:** Under no circumstances should real API keys, passwords, database URLs, JWT secrets, or tokens from `.env` or configuration files be output in chat, commits, or documentation.
10. **Update Documentation Upon Significant Architectural Changes:** Whenever endpoints, schemas, or architectural flows change, update the corresponding file in `.ai/`.

---

## 2. Navigation Guide: When to Use Each `.ai/` Document

The `.ai/` folder contains granular, dedicated documentation about the project:

| File | Purpose | When to Consult |
| :--- | :--- | :--- |
| [`.ai/PROJECT.md`](file:///d:/Yuvi/Piyush%20React/ai_calling/.ai/PROJECT.md) | High-level project identity, tech stack, dependencies, runtime, user roles, and features. | When you need an overview of what the application does, its capabilities, or configured libraries. |
| [`.ai/ARCHITECTURE.md`](file:///d:/Yuvi/Piyush%20React/ai_calling/.ai/ARCHITECTURE.md) | System design, application layers, real-time voice & WebSocket pipelines, data flow diagrams. | When modifying end-to-end flows, telephony webhooks, audio streaming, or client-server state. |
| [`.ai/FILE_STRUCTURE.md`](file:///d:/Yuvi/Piyush%20React/ai_calling/.ai/FILE_STRUCTURE.md) | Auto-generated tree of folders and files in the repository. | When locating a file, checking component layout, or verifying project directory conventions. |
| [`.ai/API.md`](file:///d:/Yuvi/Piyush%20React/ai_calling/.ai/API.md) | Comprehensive catalog of NestJS REST endpoints, SSE streams, WebSockets, payloads, and auth. | When adding, consuming, or modifying any API endpoint or webhook handler. |
| [`.ai/DATABASE.md`](file:///d:/Yuvi/Piyush%20React/ai_calling/.ai/DATABASE.md) | Prisma schema documentation, models, enums, fields, relations, indexes, and migrations. | When writing queries, Prisma transactions, or schema migrations. |
| [`.ai/RULES.md`](file:///d:/Yuvi/Piyush%20React/ai_calling/.ai/RULES.md) | Repository-specific coding conventions, typing rules, error handling standards, and constraints. | Before writing or editing any TypeScript code in either frontend or backend. |
| [`.ai/CHANGELOG.md`](file:///d:/Yuvi/Piyush%20React/ai_calling/.ai/CHANGELOG.md) | Historical log of significant system modifications and AI context updates. | When reviewing recent architectural changes or documenting new releases. |

---

## 3. Maintenance Script

The file structure map is maintained via an automated script:
```bash
npm run ai:context
```
This runs `scripts/generate-ai-context.cjs` which refreshes `.ai/FILE_STRUCTURE.md` while leaving all other documentation intact.
