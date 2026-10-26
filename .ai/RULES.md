# Repository Rules & AI Assistant Guidelines

Every AI assistant working in this repository must follow the general principles and project-specific conventions documented below.

---

## 1. General Principles

1. **Inspect Before Modifying:** Always use read/view tools on actual code files before attempting edits. Never assume file existence, exported names, or signature structures.
2. **Reuse Existing Implementation:** Check existing modules, services, and UI components before creating new ones. Avoid duplicate utilities.
3. **Avoid Duplicate Functionality:**
   - If an API call exists in `frontend/src/services/index.ts`, use it rather than writing a custom `fetch`.
   - If a React Query hook exists in `frontend/src/hooks/use-api.ts`, reuse or extend it.
4. **Follow Existing Conventions:**
   - Backend follows NestJS modular architecture (Controller -> Service -> PrismaService).
   - Frontend follows Next.js App Router with Shadcn/Radix UI patterns.
5. **Avoid Unnecessary Dependencies:** Do not install new npm packages when the task can be achieved with existing installed packages or native Node.js/browser APIs.
6. **Avoid Unnecessary Refactoring:** Keep code changes strictly minimal, safe, and focused on the user's explicit objective. Do not reformat unaffected files.
7. **Do Not Delete Functionality Without Approval:** Do not remove existing features, routes, carrier integrations, or fallback paths without explicit user instruction.
8. **Never Expose Secrets:** Do not leak real API keys, passwords, bearer tokens, or private environment variables into chat, documentation, or code commits.
9. **Do Not Change Architecture Unnecessarily:** Respect the decoupling between the Next.js frontend and NestJS backend. Do not merge them into Next.js Route Handlers without user instruction.

---

## 2. Frontend Conventions (Next.js 16 + React 19 + Tailwind v4)

1. **Next.js 16 / React 19 Compatibility:**
   - Next.js 16 App Router treats dynamic route parameters (`params`) as asynchronous Promises. Always await `params` in Page and Layout components if accessing route tokens.
   - Do not downgrade React 19 or Next.js 16 dependencies.
2. **Tailwind CSS v4:**
   - Tailwind is configured via `@tailwindcss/postcss` in `frontend/src/app/globals.css`.
   - Do not create a traditional `tailwind.config.js` unless requested; Tailwind v4 utilizes CSS-first theme variables.
3. **Client vs Server Components:**
   - Interactive components (forms, dialogs, charts, audio players, Zustand stores) must include the `"use client";` directive at the top of the file.
4. **API Service Layer:**
   - All network calls must pass through `frontend/src/services/index.ts` using the `api` client from `frontend/src/lib/api.ts`.
   - React Query hooks in `frontend/src/hooks/use-api.ts` handle caching, background fetching, and optimistic updates.
5. **Port Allocation:**
   - Frontend runs by default on port `3001` (`next dev --webpack -H 127.0.0.1 -p 3001`).
   - The backend runs on port `4000` (`http://localhost:4000/api`).

---

## 3. Backend Conventions (NestJS 11 + Prisma 6)

1. **Guard Configuration:**
   - `JwtAuthGuard` and `RolesGuard` are global providers in `app.module.ts`.
   - **Public Endpoints:** Any route that should be accessible without a JWT (e.g., login, registration, telephony webhooks, audio file streaming) **must** be decorated with `@Public()`.
   - **Role-Protected Endpoints:** Restrict privileged endpoints using `@Roles(UserRole.ADMIN, UserRole.MANAGER)`.
2. **DTO Validation:**
   - Every POST, PATCH, and PUT request body must have a strongly typed DTO decorated with `class-validator` annotations.
   - Global `ValidationPipe` has `whitelist: true` and `forbidNonWhitelisted: true`; undeclared fields in request payloads will trigger `400 Bad Request`.
3. **Telephony Webhook Requirements:**
   - **Exotel Greeting:** Must return exact `Content-Type: text/plain` with no charset (`res.setHeader('Content-Type', 'text/plain')`).
   - **Twilio Voice:** Must return valid XML (`Content-Type: text/xml`) containing `<Response><Connect><Stream ... /></Connect></Response>`.
   - Webhook endpoints must accept both GET and POST requests (`@All(...)`) to accommodate carrier retry mechanisms.
4. **Voice & Knowledge Caching:**
   - Knowledge chunks are cached in memory in `KnowledgeService.chunkCache` with a 60-second TTL to avoid database hits during live voice conversation turns.
   - Any modification or ingestion of project knowledge **must** call `this.invalidateProjectCache(projectId)` to clear stale chunk memory.
5. **Database Queries:**
   - Use `PrismaService` for database transactions and queries.
   - Always verify whether foreign keys use `onDelete: Cascade` or `onDelete: SetNull` when deleting records (e.g. deleting a project cascades to knowledge chunks and sets null on leads).

---

## 4. AI Context System Maintenance

1. **Scripts Execution:**
   - Context generation scripts must remain CommonJS (`.cjs`) so they run safely across ESM and CommonJS node setups.
   - To refresh repository structure, run:
     ```bash
     npm run ai:context
     ```
   - Never manually overwrite `.ai/FILE_STRUCTURE.md`; let `scripts/generate-ai-context.cjs` generate it.
2. **Changelog Updates:**
   - Document any architectural adjustments, added modules, or schema migrations in `.ai/CHANGELOG.md`.
