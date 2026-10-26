# API Specification: Real Estate AI Calling CRM

All API endpoints are hosted by the NestJS application under the global prefix `/api`.

---

## 1. Global Middleware & Guards

- **Prefix:** `/api`
- **Authentication:** Enforced globally by `JwtAuthGuard`. Endpoints with `@Public()` decorator bypass authentication.
- **Authorization:** Enforced globally by `RolesGuard` using reflection metadata `@Roles(...)`. Allowed roles: `ADMIN`, `MANAGER`, `AGENT`.
- **Validation:** Enforced globally by `ValidationPipe` with `whitelist: true`, `transform: true`, `forbidNonWhitelisted: true`.
- **Error Handling:** Formatted by `GlobalExceptionFilter` returning standard HTTP error envelopes.

---

## 2. Authentication & User Management

### `POST /api/auth/login`
- **Controller / Handler:** `AuthController.login()`
- **Service:** `AuthService.login()`
- **Auth:** Public (`@Public()`)
- **Validation:** `LoginDto` (`email`: string, `password`: string)
- **Response:**
  ```json
  {
    "accessToken": "jwt_token_string",
    "user": {
      "id": "cuid",
      "email": "user@example.com",
      "name": "User Name",
      "role": "ADMIN | MANAGER | AGENT"
    }
  }
  ```

### `POST /api/auth/register`
- **Controller / Handler:** `AuthController.register()`
- **Service:** `AuthService.register()`
- **Auth:** Public (`@Public()`)
- **Validation:** `RegisterDto` (`name`: string, `email`: string, `password`: string [min 6])
- **Response:** `{ "accessToken": "...", "user": { ... } }`

### `POST /api/auth/forgot-password`
- **Controller / Handler:** `AuthController.forgotPassword()`
- **Service:** `AuthService.forgotPassword()`
- **Auth:** Public (`@Public()`)
- **Validation:** `ForgotPasswordDto` (`email`: string)
- **Response:** `{ "message": "If the email exists, a reset link has been sent." }`

### `GET /api/auth/me`
- **Controller / Handler:** `AuthController.getProfile()`
- **Service:** `AuthService.getProfile()`
- **Auth:** Bearer JWT (`@CurrentUser('sub')`)
- **Response:** `{ "id": "...", "name": "...", "email": "...", "role": "...", "createdAt": "..." }`

### `GET /api/users`
- **Controller / Handler:** `UsersController.findAll()`
- **Service:** `UsersService.findAll()`
- **Auth:** Bearer JWT + `@Roles('ADMIN', 'MANAGER')`
- **Response:** `User[]` (passwords excluded)

### `GET /api/users/:id`
- **Controller / Handler:** `UsersController.findOne()`
- **Service:** `UsersService.findOne()`
- **Auth:** Bearer JWT
- **Response:** `User`

### `PATCH /api/users/:id`
- **Controller / Handler:** `UsersController.update()`
- **Service:** `UsersService.update()`
- **Auth:** Bearer JWT + `@Roles('ADMIN')`
- **Validation:** `UpdateUserDto` (`name?`, `email?`, `role?`)
- **Response:** Updated `User`

---

## 3. Leads Management

### `GET /api/leads`
- **Controller / Handler:** `LeadsController.findAll()`
- **Service:** `LeadsService.findAll()`
- **Auth:** Bearer JWT
- **Query Parameters:** `LeadQueryDto` (`search?`, `status?`, `projectId?`, `minBudget?`, `maxBudget?`)
- **Response:** `Lead[]` including related `project`

### `GET /api/leads/:id`
- **Controller / Handler:** `LeadsController.findOne()`
- **Service:** `LeadsService.findOne()`
- **Auth:** Bearer JWT
- **Response:** Complete `Lead` entity with `project`, `calls`, `appointments`, `leadNotes.user`, `activities.user`

### `POST /api/leads`
- **Controller / Handler:** `LeadsController.create()`
- **Service:** `LeadsService.create()`
- **Auth:** Bearer JWT
- **Validation:** `CreateLeadDto` (`name`, `phone`, `email?`, `source?`, `budget?`, `propertyType?`, `projectId?`, `preferredLanguage?`, `preferredLocation?`, `bhkPreference?`, `purchaseTimeline?`)
- **Response:** Created `Lead`

### `POST /api/leads/bulk`
- **Controller / Handler:** `LeadsController.createBulk()`
- **Service:** `LeadsService.createBulk()`
- **Auth:** Bearer JWT
- **Validation:** `{ "leads": CreateLeadDto[] }`
- **Response:** `Lead[]`

### `PATCH /api/leads/:id`
- **Controller / Handler:** `LeadsController.update()`
- **Service:** `LeadsService.update()`
- **Auth:** Bearer JWT
- **Validation:** `UpdateLeadDto`
- **Response:** Updated `Lead`

### `DELETE /api/leads/:id`
- **Controller / Handler:** `LeadsController.remove()`
- **Service:** `LeadsService.remove()`
- **Auth:** Bearer JWT
- **Response:** Deleted `Lead`

### `POST /api/leads/:id/notes`
- **Controller / Handler:** `LeadsController.addNote()`
- **Service:** `LeadsService.addNote()`
- **Auth:** Bearer JWT
- **Validation:** `CreateLeadNoteDto` (`content`: string)
- **Response:** Created `LeadNote` with author `user` details

---

## 4. Projects Management

### `GET /api/projects`
- **Controller / Handler:** `ProjectsController.findAll()`
- **Service:** `ProjectsService.findAll()`
- **Auth:** Bearer JWT
- **Response:** `Project[]` with counts of `leads`, `calls`, `appointments`

### `GET /api/projects/:id`
- **Controller / Handler:** `ProjectsController.findOne()`
- **Service:** `ProjectsService.findOne()`
- **Auth:** Bearer JWT
- **Response:** `Project` with associated `knowledgeSources` and counts

### `POST /api/projects`
- **Controller / Handler:** `ProjectsController.create()`
- **Service:** `ProjectsService.create()`
- **Auth:** Bearer JWT
- **Validation:** `CreateProjectDto` (`name`, `companyName?`, `location`, `builder`, `propertyType`, `startingPrice`, `endingPrice`, `possessionDate?`, `reraNumber?`, `amenities?`, `description?`, `websiteUrl?`)
- **Response:** Created `Project`

### `PATCH /api/projects/:id`
- **Controller / Handler:** `ProjectsController.update()`
- **Service:** `ProjectsService.update()`
- **Auth:** Bearer JWT
- **Validation:** `UpdateProjectDto`
- **Response:** Updated `Project`

### `DELETE /api/projects/:id`
- **Controller / Handler:** `ProjectsController.remove()`
- **Service:** `ProjectsService.remove()`
- **Auth:** Bearer JWT
- **Response:** Deleted `Project`

---

## 5. Calls & Voice Telephony

### `GET /api/calls`
- **Controller / Handler:** `CallsController.findAll()`
- **Service:** `CallsService.findAll()`
- **Auth:** Bearer JWT
- **Response:** `Call[]` with `lead` and `project` associations

### `GET /api/calls/:id`
- **Controller / Handler:** `CallsController.findOne()`
- **Service:** `CallsService.findOne()`
- **Auth:** Bearer JWT
- **Response:** `Call`

### `POST /api/calls/outbound`
- **Controller / Handler:** `CallsController.startOutbound()`
- **Service:** `CallsService.startOutboundCall()`
- **Auth:** Bearer JWT
- **Payload:** `{ "leadId": string, "browserDemo"?: boolean, "provider"?: "twilio" | "exotel" | "mcube" | "browser-demo" }`
- **Response:** Created `Call` object with initial audio base64 or carrier call ID

### `POST /api/calls/demo-turn`
- **Controller / Handler:** `CallsController.demoTurn()`
- **Service:** `CallsService.demoTurn()`
- **Auth:** Bearer JWT
- **Payload:** `{ "callId": string, "message"?: string, "audioBase64"?: string, "fileName"?: string }`
- **Response:** `{ "callId": string, "userMessage": string, "replyText": string, "outcome": string, "audioBase64": string, "mimeType": string, "transcript": string, ... }`

### `POST /api/calls/demo-turn-stream` (SSE)
- **Controller / Handler:** `CallsController.demoTurnStream()`
- **Service:** `CallsService.demoTurn(body, writeCallback)`
- **Auth:** Bearer JWT
- **Format:** Server-Sent Events (`text/event-stream; charset=utf-8`)
- **Events Emitted:** Sentence-level text and audio chunks streamed progressively for zero-perceived latency

### `POST /api/calls/:id/end`
- **Controller / Handler:** `CallsController.endDemo()`
- **Service:** `CallsService.endDemo()`
- **Auth:** Bearer JWT
- **Response:** Finalized `Call` record

### `GET /api/calls/audio/:fileName`
- **Controller / Handler:** `CallsController.streamAudio()`
- **Service:** `VoiceService.getAudioAbsolutePath()`
- **Auth:** Public (`@Public()`)
- **Response:** Raw audio binary (`audio/mpeg`, `audio/wav`, `audio/ogg`)

### Telephony Provider Status
- `GET /api/calls/twilio-status`: Returns configuration and webhook URLs for Twilio
- `GET /api/calls/exotel-status`: Returns configuration and webhook URLs for Exotel
- `GET /api/calls/mcube-status`: Returns configuration and websocket templates for MCube

### Telephony Webhooks (Public)
- `ALL /api/calls/webhooks/exotel/greeting`: Returns greeting text or audio URL for Exotel applets (`Content-Type: text/plain`)
- `ALL /api/calls/webhooks/exotel/voicebot`: Returns JSON WebSocket destination for Exotel Voicebot applets
- `ALL /api/calls/webhooks/exotel/passthru`: Processes Exotel passthru data
- `ALL /api/calls/webhooks/exotel/status`: Receives Exotel call status reports
- `ALL /api/calls/webhooks/twilio/voice`: Produces TwiML XML to connect Twilio call to `/api/calls/twilio-media` stream
- `ALL /api/calls/webhooks/twilio/status`: Receives Twilio call status callbacks

### WebSocket Streaming Endpoints
- `ws://host:port/api/calls/twilio-media?callId={callId}`: Twilio bidirectional media stream
- `ws://host:port/api/calls/exotel-media?callId={callId}`: Exotel bidirectional media stream
- `ws://host:port/bid/websocket/{callId}` or `/api/calls/mcube-media`: MCube media stream

---

## 6. Campaigns

### `GET /api/campaigns`
- **Controller / Handler:** `CampaignsController.list()`
- **Auth:** Bearer JWT
- **Response:** `CallCampaign[]` with project and queue counts

### `GET /api/campaigns/:id`
- **Controller / Handler:** `CampaignsController.get()`
- **Auth:** Bearer JWT
- **Response:** `CallCampaign` with queue item details and call relations

### `POST /api/campaigns`
- **Controller / Handler:** `CampaignsController.create()`
- **Auth:** Bearer JWT + `@Roles(ADMIN, MANAGER, AGENT)`
- **Validation:** `CreateCampaignDto` (`name`, `projectId?`, `leadIds?`, `scheduledAt?`, `timezone?`, `workingHours?`, `maxRetries?`, `retryDelayMins?`, `filterJson?`)
- **Response:** Created `CallCampaign`

### `PATCH /api/campaigns/:id/status`
- **Controller / Handler:** `CampaignsController.setStatus()`
- **Auth:** Bearer JWT + `@Roles(ADMIN, MANAGER)`
- **Payload:** `{ "status": "DRAFT | SCHEDULED | RUNNING | PAUSED | COMPLETED | CANCELLED" }`
- **Response:** Updated `CallCampaign`

### `POST /api/campaigns/process-due`
- **Controller / Handler:** `CampaignsController.processDue()`
- **Auth:** Bearer JWT + `@Roles(ADMIN, MANAGER)`
- **Response:** Batch execution status report

---

## 7. Appointments & Site Visits

### `GET /api/appointments`
- **Controller / Handler:** `AppointmentsController.findAll()`
- **Auth:** Bearer JWT
- **Query:** `status?` (`SCHEDULED | COMPLETED | CANCELLED | NO_SHOW`)
- **Response:** `Appointment[]` with `lead` and `project`

### `GET /api/appointments/:id`
- **Controller / Handler:** `AppointmentsController.findOne()`
- **Auth:** Bearer JWT
- **Response:** `Appointment`

### `POST /api/appointments`
- **Controller / Handler:** `AppointmentsController.create()`
- **Auth:** Bearer JWT
- **Validation:** `CreateAppointmentDto` (`leadId`, `projectId?`, `date`, `time`, `notes?`, `status?`)
- **Response:** Created `Appointment` (triggers Google Calendar sync if configured)

### `PATCH /api/appointments/:id`
- **Controller / Handler:** `AppointmentsController.update()`
- **Auth:** Bearer JWT
- **Validation:** `UpdateAppointmentDto`
- **Response:** Updated `Appointment`

### `DELETE /api/appointments/:id`
- **Controller / Handler:** `AppointmentsController.remove()`
- **Auth:** Bearer JWT
- **Response:** Deleted `Appointment`

---

## 8. Knowledge Base & RAG

### `GET /api/knowledge/project/:projectId`
- **Controller / Handler:** `KnowledgeController.list()`
- **Auth:** Bearer JWT
- **Response:** `ProjectKnowledgeSource[]` with chunk count

### `GET /api/knowledge/:id`
- **Controller / Handler:** `KnowledgeController.get()`
- **Auth:** Bearer JWT
- **Response:** `ProjectKnowledgeSource` with chunk list

### `POST /api/knowledge/website`
- **Controller / Handler:** `KnowledgeController.addWebsite()`
- **Auth:** Bearer JWT + `@Roles(ADMIN, MANAGER, AGENT)`
- **Validation:** `AddWebsiteDto` (`projectId`, `url`, `title?`)
- **Response:** Ingested `ProjectKnowledgeSource`

### `POST /api/knowledge/text`
- **Controller / Handler:** `KnowledgeController.addText()`
- **Auth:** Bearer JWT
- **Validation:** `AddTextDto` (`projectId`, `title`, `text`, `sourceType?`)
- **Response:** Created `ProjectKnowledgeSource`

### `POST /api/knowledge/upload`
- **Controller / Handler:** `KnowledgeController.upload()`
- **Auth:** Bearer JWT
- **Middleware:** `FileInterceptor('file')`
- **Payload:** `multipart/form-data` with `file`, `projectId`, `title?`, `sourceType?`
- **Response:** Parsed and indexed `ProjectKnowledgeSource`

### `POST /api/knowledge/:id/reprocess`
- **Controller / Handler:** `KnowledgeController.reprocess()`
- **Auth:** Bearer JWT + `@Roles(ADMIN, MANAGER)`
- **Response:** Re-indexed `ProjectKnowledgeSource`

### `DELETE /api/knowledge/:id`
- **Controller / Handler:** `KnowledgeController.remove()`
- **Auth:** Bearer JWT + `@Roles(ADMIN, MANAGER)`
- **Response:** Removed `ProjectKnowledgeSource`

---

## 9. AI Agent Settings & Playbook

### `GET /api/ai/settings`
- **Controller / Handler:** `AiController.getSettings()`
- **Auth:** Bearer JWT
- **Response:** `AiAgentSettings`

### `GET /api/ai/playbook`
- **Controller / Handler:** `AiController.getPlaybook()`
- **Auth:** Bearer JWT
- **Response:** `AgentPlaybookSummary`

### `PATCH /api/ai/settings`
- **Controller / Handler:** `AiController.updateSettings()`
- **Auth:** Bearer JWT
- **Validation:** `UpdateAiSettingsDto` (`agentName?`, `agentVoice?`, `language?`, `tone?`, `llmModel?`, `systemPrompt?`, `companyName?`, `workingHours?`, `knowledgeBase?`, `approvedPlaybook?`, `retryRules?`, `timezone?`, `isActive?`)
- **Response:** Updated `AiAgentSettings`

### `POST /api/ai/preview-voice`
- **Controller / Handler:** `AiController.previewVoice()`
- **Auth:** Bearer JWT
- **Payload:** `{ "text"?: string, "speaker"?: string, "language"?: string }`
- **Response:** `{ "speaker": "...", "language": "...", "mimeType": "audio/mpeg", "audioBase64": "...", "fileName": "..." }`

---

## 10. Analytics & Feedback

### `GET /api/analytics/dashboard`
- **Controller / Handler:** `AnalyticsController.getDashboardStats()`
- **Auth:** Bearer JWT
- **Response:** Key performance indicators (calls today, connected rate, qualified rate, appointments booked, recent activities)

### `GET /api/analytics`
- **Controller / Handler:** `AnalyticsController.getFullAnalytics()`
- **Auth:** Bearer JWT
- **Response:** Historical breakdowns (daily/monthly calls, conversion rates, property types, lead source performance)

### `GET /api/feedback`
- **Controller / Handler:** `FeedbackController.list()`
- **Auth:** Bearer JWT
- **Query:** `status?` (`PENDING | APPROVED | REJECTED`)
- **Response:** `CallFeedback[]`

### `POST /api/feedback`
- **Controller / Handler:** `FeedbackController.create()`
- **Auth:** Bearer JWT
- **Validation:** `CreateFeedbackDto` (`callId`, `rating`, `category?`, `comment?`, `correctedSummary?`, `correctedReply?`, `correctedFactsJson?`)
- **Response:** Created `CallFeedback`

### `PATCH /api/feedback/:id/moderate`
- **Controller / Handler:** `FeedbackController.moderate()`
- **Auth:** Bearer JWT + `@Roles(ADMIN)`
- **Payload:** `{ "status": "APPROVED | REJECTED" }`
- **Response:** Moderated `CallFeedback`

### `GET /api/audit`
- **Controller / Handler:** `AuditController.list()`
- **Auth:** Bearer JWT + `@Roles(ADMIN, MANAGER)`
- **Query:** `limit?` (default 100)
- **Response:** `AuditLog[]`
