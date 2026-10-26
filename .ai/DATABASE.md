# Database Architecture & Schema: Real Estate AI Calling CRM

This document details the database layer, schema models, relations, and indexes discovered in `backend/prisma/schema.prisma` and `docker-compose.yml`.

---

## 1. Database Technologies & Configuration

- **ORM:** Prisma Client (`@prisma/client` v6.19.3)
- **Database Engine:** MySQL 8.0 (`provider = "mysql"` in `backend/prisma/schema.prisma`, driven by `DATABASE_URL` environment variable)
- **Container Configuration:** MySQL 8.0 container defined in `docker-compose.yml` (`image: mysql:8.0`, port 3306, `utf8mb4` charset)
- **Field Mappings for MySQL:**
  - Extended text fields (`transcript`, `rawText`, `transcriptSnapshot`) mapped to `@db.LongText`.
  - Content, summaries, notes, and prompts mapped to `@db.Text` to prevent `VARCHAR(191)` truncation.
- **Database Seed File:** `backend/prisma/seed.ts` (populates default Admin/Agent users, projects, and leads)

---

## 2. Enums

- **`UserRole`:** `ADMIN`, `MANAGER`, `AGENT`
- **`LeadStatus`:** `NEW`, `CONTACTED`, `QUALIFIED`, `CALLBACK_REQUESTED`, `SITE_VISIT_INTERESTED`, `NEGOTIATION`, `CONVERTED`, `NOT_INTERESTED`, `LOST`
- **`LeadSource`:** `WEBSITE`, `REFERRAL`, `SOCIAL_MEDIA`, `COLD_CALL`, `WALK_IN`, `OTHER`
- **`PropertyType`:** `APARTMENT`, `VILLA`, `PLOT`, `COMMERCIAL`, `PENTHOUSE`
- **`CallOutcome`:** `CONNECTED`, `NO_ANSWER`, `VOICEMAIL`, `CALLBACK_REQUESTED`, `QUALIFIED`, `SITE_VISIT_INTERESTED`, `NOT_INTERESTED`
- **`CallStatus`:** `QUEUED`, `INITIATED`, `RINGING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `NO_ANSWER`, `SKIPPED`, `CANCELLED`
- **`AppointmentStatus`:** `SCHEDULED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`
- **`KnowledgeSourceType`:** `PDF`, `TEXT`, `FAQ`, `WEBSITE`, `PRICE_SHEET`, `RERA`, `FLOOR_PLAN`, `PAYMENT_PLAN`, `AMENITIES`, `OTHER`
- **`KnowledgeStatus`:** `PENDING`, `PROCESSING`, `READY`, `FAILED`, `ARCHIVED`
- **`CampaignStatus`:** `DRAFT`, `SCHEDULED`, `RUNNING`, `PAUSED`, `COMPLETED`, `CANCELLED`
- **`QueueItemStatus`:** `QUEUED`, `CALLING`, `COMPLETED`, `FAILED`, `CALLBACK`, `SKIPPED`, `CANCELLED`
- **`FeedbackRating`:** `HELPFUL`, `NEUTRAL`, `POOR`
- **`FeedbackStatus`:** `PENDING`, `APPROVED`, `REJECTED`

---

## 3. Entity Models & Relationships

### `User`
Manages system staff, CRM credentials, and access roles.
- `id` (String, PK, `@default(cuid())`)
- `name` (String)
- `email` (String, Unique)
- `password` (String, bcrypt hashed)
- `role` (UserRole, `@default(AGENT)`)
- `createdAt` (DateTime, `@default(now())`)
- `updatedAt` (DateTime, `@updatedAt`)
- **Relations:**
  - `leadNotes`: HasMany `LeadNote`
  - `activities`: HasMany `Activity`
  - `feedbackSubmitted`: HasMany `CallFeedback` (as submitter)
  - `feedbackApproved`: HasMany `CallFeedback` (as approver)
  - `auditLogs`: HasMany `AuditLog`

### `Project`
Represents real estate developments pitched by agents and the AI caller.
- `id` (String, PK, `@default(cuid())`)
- `name` (String)
- `companyName` (String, default `""`)
- `location` (String)
- `builder` (String)
- `propertyType` (PropertyType)
- `startingPrice` (Float)
- `endingPrice` (Float)
- `possessionDate` (DateTime, Optional)
- `reraNumber` (String, Optional)
- `amenities` (Json, Optional)
- `description` (String, Optional)
- `websiteUrl` (String, Optional)
- `createdAt` (DateTime, `@default(now())`)
- `updatedAt` (DateTime, `@updatedAt`)
- **Relations:** `leads`, `appointments`, `knowledgeSources`, `knowledgeChunks`, `calls`, `campaigns`, `feedback`

### `Lead`
Core prospect record tracking qualification, preferences, and call status.
- `id` (String, PK, `@default(cuid())`)
- `name` (String)
- `phone` (String)
- `email` (String, Optional)
- `source` (LeadSource, `@default(OTHER)`)
- `budget` (Float, Optional)
- `propertyType` (PropertyType, Optional)
- `status` (LeadStatus, `@default(NEW)`)
- `notes` (String, Optional)
- `projectId` (String, Optional, FK to `Project.id`, `onDelete: SetNull`)
- `aiSummary` (String, Optional)
- `preferredLanguage` (String, Optional)
- `preferredLocation` (String, Optional)
- `bhkPreference` (String, Optional)
- `purchaseTimeline` (String, Optional)
- `interestLevel` (String, Optional)
- `interestScore` (Int, Optional)
- `objections` (String, Optional)
- `siteVisitInterest` (Boolean, default `false`)
- `callbackAt` (DateTime, Optional)
- `doNotCall` (Boolean, default `false`)
- `consentToCall` (Boolean, default `true`)
- `suggestedNextAction` (String, Optional)
- `lastQualifiedAt` (DateTime, Optional)
- `createdAt` (DateTime, `@default(now())`)
- `updatedAt` (DateTime, `@updatedAt`)
- **Relations:** `project`, `calls`, `appointments`, `leadNotes`, `activities`, `queueItems`, `feedback`

### `LeadNote`
Human agent and automated notes tied to leads.
- `id` (String, PK, `@default(cuid())`)
- `leadId` (String, FK to `Lead.id`, `onDelete: Cascade`)
- `userId` (String, FK to `User.id`, `onDelete: Cascade`)
- `content` (String)
- `createdAt` (DateTime, `@default(now())`)

### `Activity`
Audit trail of interactions per lead (status changes, calls initiated).
- `id` (String, PK, `@default(cuid())`)
- `leadId` (String, FK to `Lead.id`, `onDelete: Cascade`)
- `userId` (String, Optional, FK to `User.id`, `onDelete: SetNull`)
- `type` (String)
- `description` (String)
- `metadata` (Json, Optional)
- `createdAt` (DateTime, `@default(now())`)

### `Call`
Detailed record of phone and demo browser calls.
- `id` (String, PK, `@default(cuid())`)
- `leadId` (String, FK to `Lead.id`, `onDelete: Cascade`)
- `projectId` (String, Optional, FK to `Project.id`, `onDelete: SetNull`)
- `campaignId` (String, Optional, FK to `CallCampaign.id`, `onDelete: SetNull`)
- `duration` (Int, default `0`)
- `interestScore` (Int, Optional)
- `transcript` (String, Optional)
- `summary` (String, Optional)
- `recordingUrl` (String, Optional)
- `outcome` (CallOutcome, default `CONNECTED`)
- `status` (CallStatus, default `INITIATED`)
- `provider` (String, default `"twilio"`)
- `providerCallId` (String, Optional)
- `greetingText` (String, Optional)
- `languageDetected` (String, Optional)
- `qualificationJson` (Json, Optional)
- `sourcesJson` (Json, Optional)
- `suggestedNextAction` (String, Optional)
- `createdAt` (DateTime, `@default(now())`)
- `updatedAt` (DateTime, `@updatedAt`)

### `Appointment`
Site visits and meeting dates agreed upon during AI or agent calls.
- `id` (String, PK, `@default(cuid())`)
- `leadId` (String, FK to `Lead.id`, `onDelete: Cascade`)
- `projectId` (String, Optional, FK to `Project.id`, `onDelete: SetNull`)
- `date` (DateTime)
- `time` (String)
- `status` (AppointmentStatus, default `SCHEDULED`)
- `notes` (String, Optional)
- `googleEventId` (String, Optional)
- `googleLink` (String, Optional)
- `createdAt` (DateTime, `@default(now())`)
- `updatedAt` (DateTime, `@updatedAt`)

### `AiAgentSettings`
Global AI persona, LLM configuration, and voice settings.
- `id` (String, PK, `@default(cuid())`)
- `agentName` (String, default `"Real Estate AI Agent"`)
- `agentVoice` (String, default `"shubh"`)
- `language` (String, default `"en-IN"`)
- `tone` (String, default `"friendly"`)
- `llmModel` (String, default `"gemini-flash-lite-latest"`)
- `systemPrompt` (String, default `""`)
- `companyName` (String, default `""`)
- `workingHours` (Json, Optional)
- `knowledgeBase` (Json, Optional)
- `approvedPlaybook` (Json, Optional)
- `retryRules` (Json, Optional)
- `timezone` (String, default `"Asia/Kolkata"`)
- `isActive` (Boolean, default `true`)
- `createdAt` (DateTime, `@default(now())`)
- `updatedAt` (DateTime, `@updatedAt`)

### `ProjectKnowledgeSource` & `ProjectKnowledgeChunk`
RAG document store for project-specific question answering.
- **Source:**
  - `id` (String, PK)
  - `projectId` (String, FK to `Project.id`, `onDelete: Cascade`)
  - `title` (String)
  - `sourceType` (KnowledgeSourceType)
  - `status` (KnowledgeStatus)
  - `fileName`, `filePath`, `sourceUrl`, `mimeType`, `rawText`, `errorMessage`, `metadata`
- **Chunk:**
  - `id` (String, PK)
  - `projectId` (String, FK to `Project.id`, `onDelete: Cascade`)
  - `sourceId` (String, FK to `ProjectKnowledgeSource.id`, `onDelete: Cascade`)
  - `chunkIndex` (Int)
  - `content` (String)
  - `tokenCount` (Int, default `0`)
  - `embedding` (Json, Optional)
  - `metadata` (Json, Optional)
  - **Indexes:**
    - `@@index([projectId])`
    - `@@index([sourceId])`

### `CallCampaign` & `CampaignQueueItem`
Outbound bulk dialing pipeline.
- **Campaign:**
  - `id` (String, PK)
  - `name` (String)
  - `projectId` (String, Optional, FK to `Project.id`, `onDelete: SetNull`)
  - `status` (CampaignStatus, default `DRAFT`)
  - `scheduledAt`, `startedAt`, `completedAt`
  - `timezone` (default `"Asia/Kolkata"`)
  - `workingHours` (Json, Optional)
  - `maxRetries` (Int, default `2`), `retryDelayMins` (Int, default `60`)
  - `filterJson` (Json, Optional)
  - `createdById` (String, Optional)
- **Queue Item:**
  - `id` (String, PK)
  - `campaignId` (String, FK to `CallCampaign.id`, `onDelete: Cascade`)
  - `leadId` (String, FK to `Lead.id`, `onDelete: Cascade`)
  - `callId` (String, Optional, FK to `Call.id`, `onDelete: SetNull`)
  - `status` (QueueItemStatus, default `QUEUED`)
  - `attempts` (Int, default `0`)
  - `nextAttempt` (DateTime, Optional)
  - `lastError` (String, Optional)
  - **Indexes:**
    - `@@index([campaignId, status])`
    - `@@index([leadId])`

### `CallFeedback`
Auditing, rating, and AI prompt improvement tracking.
- `id` (String, PK)
- `callId` (String, FK to `Call.id`, `onDelete: Cascade`)
- `leadId` (String, Optional, FK to `Lead.id`, `onDelete: SetNull`)
- `projectId` (String, Optional, FK to `Project.id`, `onDelete: SetNull`)
- `rating` (FeedbackRating)
- `status` (FeedbackStatus, default `PENDING`)
- `category`, `comment`, `correctedSummary`, `correctedReply`, `correctedFactsJson`, `aiReplySnapshot`, `transcriptSnapshot`
- `createdById` (FK to `User.id`), `approvedById` (FK to `User.id`)

### `AuditLog`
Security and administrative tracking.
- `id` (String, PK)
- `actorId` (String, Optional, FK to `User.id`, `onDelete: SetNull`)
- `action` (String)
- `entityType` (String)
- `entityId` (String, Optional)
- `details` (Json, Optional)
- `createdAt` (DateTime, `@default(now())`)
- **Indexes:**
  - `@@index([entityType, entityId])`
  - `@@index([createdAt])`
