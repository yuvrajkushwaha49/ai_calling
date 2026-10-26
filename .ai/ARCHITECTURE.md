# System Architecture: Real Estate AI Calling CRM

This document describes the concrete, discovered architecture of the repository based exclusively on source code analysis.

---

## 1. High-Level Architectural Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js 16)                           │
│  Port 3001 (or 3000)                                                  │
│                                                                        │
│   App Router UI Pages:                                                 │
│   ├── (auth): /login, /forgot-password                                 │
│   └── (dashboard): /dashboard, /leads, /projects, /calls,              │
│                    /campaigns, /appointments, /ai-settings,            │
│                    /analytics, /knowledge, /feedback                   │
│                                                                        │
│   Client State:                     Server State:                      │
│   ├── Zustand (auth, ui)            └── TanStack React Query           │
│   Audio / Simulator:                                                   │
│   └── Web Audio API, MediaRecorder, SSE stream reader                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST / SSE
                                    │ (Bearer JWT Auth)
┌───────────────────────────────────▼────────────────────────────────────┐
│                         BACKEND (NestJS 11)                            │
│  Port 4000 (Global Prefix: /api)                                       │
│                                                                        │
│   Global Pipeline:                                                     │
│   ├── ValidationPipe (whitelist, transform)                            │
│   ├── JwtAuthGuard (Passport JWT)                                      │
│   ├── RolesGuard (ADMIN, MANAGER, AGENT)                               │
│   └── GlobalExceptionFilter                                            │
│                                                                        │
│   Modular Services:                                                    │
│   ├── AuthModule / UsersModule                                         │
│   ├── LeadsModule / ProjectsModule                                     │
│   ├── CallsModule (Twilio / Exotel / MCube / Demo turn)                │
│   ├── CampaignsModule / AppointmentsModule                             │
│   ├── ConversationModule / LlmModule (Gemini / OpenAI)                 │
│   ├── VoiceModule / ElevenLabsModule (TTS / STT)                       │
│   ├── KnowledgeModule (PDF parser, chunking, memory cache)             │
│   ├── AnalyticsModule / FeedbackModule / AuditModule                   │
│   └── GoogleCalendarModule (googleapis OAuth2)                         │
└──────────────┬────────────────────┬────────────────────┬───────────────┘
               │                    │                    │
               ▼                    ▼                    ▼
     ┌──────────────────┐ ┌──────────────────┐ ┌─────────────────────┐
     │ TELEPHONY / AUDIO│ │    AI ENGINES    │ │   DATA & STORAGE    │
     │   Twilio / Exotel│ │  Google Gemini   │ │  Prisma ORM 6       │
     │   MCube WebSocket│ │  ElevenLabs TTS  │ │  SQLite (schema)    │
     │  WebSocketServer │ │  Google Calendar │ │  PostgreSQL 16 (yml)│
     │  Audio Streaming │ │  OpenAI Fallback │ │  Local Filesystem   │
     └──────────────────┘ └──────────────────┘ └─────────────────────┘
```

---

## 2. Application Layers

### Layer 1: Client / Presentation (Frontend)
- **Framework:** Next.js 16 with React 19.
- **Routing Engine:** App Router organized with route groups:
  - `(auth)`: Public authentication screens.
  - `(dashboard)`: Authenticated CRM management screens wrapped in sidebar navigation and header bars.
- **State Architecture:**
  - **Client Authentication:** Zustand store (`auth-store.ts`) keeps JWT tokens and user objects, persisting to browser `localStorage`.
  - **UI Layout:** Zustand store (`ui-store.ts`) handles sidebar collapse and drawer states.
  - **Server Cache:** TanStack React Query (`use-api.ts`) manages caching, background invalidation, and optimistic mutations for leads, projects, calls, appointments, and analytics.
- **Voice Simulator:**
  - Uses browser Web Audio API and MediaRecorder.
  - Supports Server-Sent Events (SSE) via `/api/calls/demo-turn-stream` for low-latency streaming of AI agent voice responses sentence-by-sentence.

### Layer 2: API Gateway & Application Controller (Backend)
- **Framework:** NestJS 11 running on Express platform.
- **Global Prefix:** All endpoints served under `/api/*`.
- **Cross-Origin Resource Sharing (CORS):** Configurable via `CORS_ORIGINS`, defaulting to `http://localhost:3000,http://127.0.0.1:3000`.
- **Payload Handling:** Express JSON and URL-encoded body parsers with a 15MB limit to accommodate audio and document uploads.
- **Execution Pipeline:**
  1. `GlobalExceptionFilter`: Intercepts unhandled errors and normalizes API error response structures.
  2. `JwtAuthGuard`: Enforces bearer token authentication across all controllers unless overridden by `@Public()`.
  3. `RolesGuard`: Verifies user roles (`ADMIN`, `MANAGER`, `AGENT`) using reflection metadata `@Roles(...)`.
  4. `ValidationPipe`: Whitelists DTO properties, strips unauthorized fields, and automatically transforms payloads into class instances.

### Layer 3: Business Domain & AI Orchestration
- **Conversation Engine (`conversation/`):**
  - Manages real-time dialog state, customer objections, site visit scheduling intent, and lead qualification scoring.
  - Combines project details, AI system prompt, and RAG knowledge chunks into dynamic prompt context.
- **LLM Layer (`llm/`):**
  - Primary: Google Gemini (`gemini-flash-lite-latest`) for low-latency responses and text embeddings.
  - Fallback: OpenAI API (`gpt-4o-mini` / `chat.completions`).
- **Voice Layer (`voice/`, `elevenlabs/`):**
  - Synthesizes audio using ElevenLabs TTS.
  - Normalizes regional Indian place names and multilingual pronunciations (`place-names.ts`).
  - Caches and serves generated audio clips directly via static streaming endpoints (`/api/calls/audio/:fileName`).
- **Knowledge Base RAG (`knowledge/`):**
  - Ingests PDFs (`pdf-parse`), plain text, and web pages.
  - Chunks text documents into semantic blocks and computes vector embeddings.
  - Uses an in-memory chunk cache (`chunkCache`) with 60-second TTL to avoid database reads during high-throughput phone calls.
- **Telephony & Media Streaming (`calls/`):**
  - Direct HTTP upgrade handling in `main.ts` for WebSocket media streaming.
  - Twilio WebSocket handler: `/api/calls/twilio-media`.
  - Exotel WebSocket handler: `/api/calls/exotel-media`.
  - MCube WebSocket handler: `/bid/websocket/:callId` and `/api/calls/mcube-media`.
  - Live TwiML and Exotel XML/plain-text webhook dispatchers.

### Layer 4: Persistence & Data Access
- **ORM:** Prisma Client 6.19.3.
- **Database Engine:**
  - Active schema definition: SQLite (`provider = "sqlite"` in `schema.prisma`).
  - Containerized deployment configuration: PostgreSQL 16 Alpine (`postgres:16-alpine` in `docker-compose.yml`).
- **File System Storage:**
  - Uploaded brochures and PDFs saved locally in `backend/uploads/knowledge/`.

---

## 3. End-to-End Voice Call Data Flow

```
[Customer Phone]
       │
       ▼ (PSTN / Mobile Network)
[Telephony Carrier: Twilio / Exotel / MCube]
       │
       ▼ HTTP Webhook: Incoming / Outbound Answered
[NestJS CallsController (/api/calls/webhooks/*)]
       │
       ▼ Upgrades HTTP Connection to WebSocket
[TwilioStreamService / ExotelStreamService / McubeStreamService]
       │
       ├──► Transcribes incoming audio stream (STT / Scribe)
       │
       ▼ User text input
[ConversationService.processTurn()]
       │
       ├──► Retrieves Project Knowledge Chunks (KnowledgeService cache)
       ├──► Evaluates intent & qualification (ConversationService)
       ├──► Calls LLM (Gemini / OpenAI) for response text
       │
       ▼ Generated agent reply text
[VoiceService.textToSpeech() / ElevenLabsService]
       │
       ▼ Raw audio buffer (mulaw 8kHz / mp3)
[WebSocket Stream / HTTP Audio Response]
       │
       ▼ Streams audio packets back to carrier
[Customer hears AI agent response]
       │
       ▼ Post-call webhook or session close
[CallsService.update() & LeadsService.update()]
       ├── Transcripts & summary saved
       ├── Qualification & lead status updated
       └── Google Calendar meeting booked (if site visit requested)
```

---

## 4. Routing Architecture

### Frontend Routes
| Route | Access | Purpose |
| :--- | :--- | :--- |
| `/login` | Public | User authentication screen |
| `/forgot-password` | Public | Password recovery form |
| `/dashboard` | Protected | High-level metrics, charts, quick stats |
| `/leads` | Protected | Lead list, filters, details drawer, import/export |
| `/projects` | Protected | Real estate property listings & specifications |
| `/calls` | Protected | Call logs, recording playback, transcript viewer, browser call simulator |
| `/campaigns` | Protected | Outbound automated calling batch campaigns |
| `/appointments` | Protected | Scheduled site visits and calendar sync |
| `/ai-settings` | Protected | Voice personality, prompt configuration, working hours |
| `/knowledge` | Protected | Knowledge base PDF uploads and website scrapers |
| `/analytics` | Protected | Detailed call outcome, conversion, and agent performance reports |
| `/feedback` | Protected | Agent reply auditing, rating, and correction moderation |

### Backend API Routes
All routes prefixed with `/api`. Details fully cataloged in [`.ai/API.md`](file:///d:/Yuvi/Piyush%20React/ai_calling/.ai/API.md).
