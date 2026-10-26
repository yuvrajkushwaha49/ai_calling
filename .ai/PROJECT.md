# Project Overview: Real Estate AI Calling CRM

## 1. Project Identification
- **Project Name:** `realestate-crm` (Root `package.json`), Display Name: **Real Estate AI Calling CRM** (`README.md`)
- **Project Type:** Full-Stack Web Application (Monorepo with decoupled Next.js frontend and NestJS backend)
- **Project Purpose:** An AI-powered voice outreach and inbound calling CRM designed for real estate companies, property builders, and sales agents. It conducts automated natural language phone conversations (English, Hindi, Hinglish), qualifies buyer interest, answers project-specific queries using project knowledge documents (brochures/PDFs/websites), schedules site visits/appointments synced to Google Calendar, executes outbound calling campaigns, and logs transcripts, audio recordings, and analytics.

---

## 2. Technology Stack

### Languages & Runtimes
- **Runtime:** Node.js (v20+ recommended per `README.md`)
- **Languages:** TypeScript (v5.7.3 in backend, v5 in frontend)

### Frontend
- **Framework:** Next.js 16.2.9 (App Router)
- **UI Library:** React 19.2.4 & React DOM 19.2.4
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`, `tailwindcss`)
- **Component Primitives:** Radix UI (`@radix-ui/react-dialog`, `@radix-ui/react-select`, `@radix-ui/react-slot`), `class-variance-authority`, `clsx`, `tailwind-merge`
- **Iconography:** Lucide React (`lucide-react` v0.525.0)
- **State Management:**
  - Client state: Zustand v5.0.14 (`auth-store.ts`, `ui-store.ts`)
  - Server state / Caching: TanStack React Query v5.101.0 (`use-api.ts`)
  - Theme state: `next-themes` v0.4.6 (Dark / Light mode)
- **Forms & Validation:** React Hook Form v7.79.0, Zod v3.25.76 (`@hookform/resolvers`)
- **Data Visualization:** Recharts v3.8.1
- **File Utilities:** `xlsx` v0.18.5 (bulk lead import)

### Backend
- **Framework:** NestJS 11.0.1 (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`)
- **ORM / Database Access:** Prisma ORM 6.19.3 (`@prisma/client`, `prisma`)
- **Database Engine:** MySQL 8.0 (`provider = "mysql"` in `backend/prisma/schema.prisma`)
- **Container Setup:** MySQL 8.0 container in `docker-compose.yml` (`image: mysql:8.0`, port 3306)
- **Reverse Proxy:** Nginx (`nginx:alpine` in `docker-compose.yml`, ports 80/443)
- **Real-time / WebSockets:** `ws` v8.21.3 (Native HTTP upgrade in `main.ts` for media streams)
- **Authentication & Security:**
  - Passport JWT (`passport`, `passport-jwt`, `@nestjs/passport`, `@nestjs/jwt`)
  - Password hashing: `bcrypt` v6.0.0
- **Validation:** `class-validator` v0.14.4, `class-transformer` v0.5.1
- **File / Document Processing:** `pdf-parse` v2.4.5 (knowledge base PDF ingestion)
- **Calendar API:** `googleapis` v176.0.0 (Google Calendar OAuth2 integration)

### Build & Tooling
- **Build Tools:**
  - Frontend: Next.js CLI with Webpack mode (`next dev --webpack -H 127.0.0.1 -p 3001`, `next build`)
  - Backend: Nest CLI (`@nestjs/cli`, `nest build`)
  - Root: npm run orchestration scripts
- **Linters & Formatters:** ESLint 9 (`eslint`, `eslint-config-next`, `typescript-eslint`), Prettier 3
- **Test Frameworks:** Jest 30 (`ts-jest`, `@types/jest`)

---

## 3. Main Features & Modules

### Frontend Modules (`frontend/src/app/(dashboard)/`)
1. **Dashboard (`/dashboard`):** Real-time KPI summaries, call metrics, recent activity feeds, conversion charts.
2. **Leads (`/leads`):** Search, status filtering, lead drawer with timeline, call history notes, bulk Excel import.
3. **Projects (`/projects`):** Real estate development listings (units, pricing, location, builder, amenities, RERA numbers).
4. **Calls (`/calls`):** Call log history, recordings, audio players, full call transcripts, qualification breakdowns, AI summaries. Includes live interactive browser demo call simulator.
5. **Campaigns (`/campaigns`):** Batch outbound calling campaigns, lead filtering, scheduling, retry settings, queue execution.
6. **Appointments (`/appointments`):** Site visit calendar, status management, notes, Google Calendar link integration.
7. **Knowledge Base (`/knowledge`):** Project-specific document ingestion (PDF upload, raw text, website URLs) with automatic chunking and embedding.
8. **AI Agent Settings (`/ai-settings`):** Voice configuration, language preference, system prompt, working hours, playbook parameters.
9. **Analytics (`/analytics`):** Comprehensive metrics on call volumes, qualification rates, lead sources, and outcomes.
10. **Feedback & Quality Assurance (`/feedback`):** Call accuracy reviews, sentiment ratings, manager moderation, prompt improvement tracking.

### Backend Modules (`backend/src/`)
- `auth`: JWT authentication, login, registration, password reset, current user profile.
- `users`: User administration and role management (`ADMIN`, `MANAGER`, `AGENT`).
- `leads`: Lead lifecycle, status updates, notes, activity timelines, bulk upload.
- `projects`: Real estate project property management.
- `calls`: Telephony integration (Twilio, Exotel, MCube), WebSocket media streamers, browser audio demo, SSE audio streaming.
- `campaigns`: Campaign creation, queue management, retry logic, batch processing.
- `appointments`: Site visit scheduling, calendar sync.
- `ai`: AI agent settings, playbook summaries, voice preview generation.
- `analytics`: Aggregated dashboard metrics and comprehensive KPI calculations.
- `knowledge`: RAG document parsing (`pdf-parse`), web scraping, chunking, caching, vector search.
- `conversation`: Multi-turn dialogue management, intent recognition, objection handling, qualification scoring.
- `elevenlabs`: ElevenLabs TTS (text-to-speech) and speech synthesis.
- `voice`: Unified voice interface, speech pronunciation formatting.
- `llm`: Gemini (`gemini-flash-lite-latest`) & OpenAI chat completion and embedding services.
- `google-calendar`: Automated calendar event creation and meeting invitations.
- `feedback`: Agent evaluation, rating, correction submissions, admin approval workflows.
- `audit`: System-wide audit logging for governance and traceability.

---

## 4. User Roles & Authentication
- **User Roles:**
  - `ADMIN`: Full access to all operations, user management, feedback moderation, system settings.
  - `MANAGER`: Access to leads, campaigns, appointments, analytics, knowledge base, audit logs.
  - `AGENT`: Standard sales access to view/call leads, manage assigned appointments, submit feedback.
- **Authentication Method:**
  - JWT Bearer tokens issued upon `/api/auth/login`.
  - Global `JwtAuthGuard` enforced on all routes except those decorated with `@Public()`.
  - Global `RolesGuard` checking `UserRole` metadata on endpoints decorated with `@Roles(...)`.

---

## 5. External Services & Integrations
- **Telephony Services:**
  - **Twilio:** Outbound phone calling, TwiML voice webhooks, bidirectional audio streaming over WebSocket (`/api/calls/twilio-media`).
  - **Exotel:** Outbound phone calling, voicebot webhooks, audio streaming over WebSocket (`/api/calls/exotel-media`).
  - **MCube:** Outbound telephony integration, WebSocket streaming (`/bid/websocket/:callId`).
- **Voice AI:**
  - **ElevenLabs:** Primary Text-to-Speech (TTS) engine and voice cloning.
  - **Sarvam AI:** Service exists in codebase (`backend/src/sarvam/`), but marked legacy/unused in favor of ElevenLabs.
- **LLM & Embeddings:**
  - **Google Gemini:** Primary conversation engine (`gemini-flash-lite-latest`) and embeddings for project RAG.
  - **OpenAI:** Secondary fallback for chat completions.
- **Calendar:**
  - **Google Calendar API:** Auto-schedules site visits and meetings from AI voice call agreements.

---

## 6. Storage & File Handling
- **Media & Audio:** Generated TTS audio files stored and streamed through `voice.service.ts` (`/api/calls/audio/:fileName`).
- **Knowledge Uploads:** Uploaded brochures and PDFs stored in local filesystem at `backend/uploads/knowledge`.
- **In-Memory Cache:** `KnowledgeService` maintains an in-memory chunk cache with a 60-second TTL to avoid database query overhead during live phone calls.
- **Cloud Object Storage (S3 / GCS):** *Not detected.*

---

## 7. Deployment & Infrastructure
- **Target Platform:** AWS EC2 (Ubuntu 22.04 / 24.04 LTS)
- **Containerization:** Production Docker Compose ([`docker-compose.yml`](file:///d:/Yuvi/Piyush%20React/ai_calling/docker-compose.yml)) orchestrating:
  - `mysql:8.0` (database)
  - `backend` (NestJS 11 production image)
  - `frontend` (Next.js 16 standalone production image)
  - `nginx:alpine` (reverse proxy with WebSocket upgrade support, SSL)
- **Deployment Guide:** Fully detailed in [`AWS_DEPLOYMENT_GUIDE.md`](file:///d:/Yuvi/Piyush%20React/ai_calling/AWS_DEPLOYMENT_GUIDE.md)
- **Setup Script:** Automated provisioning script at [`scripts/setup-aws-ec2.sh`](file:///d:/Yuvi/Piyush%20React/ai_calling/scripts/setup-aws-ec2.sh)
- **Local Tunneling:** Cloudflared / ngrok for local development telephony webhooks.
