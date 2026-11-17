# WORKAINS REALITY — ARIA ROUND 7 BASELINE AUDIT
**Project:** Workains Reality — AI Calling CRM  
**Agent:** Aria (Independent Multi-Builder Channel Partner Helpline Advisor)  
**Round:** 7 (Production Reliability, Project Context Lock & Conversation Continuity)  
**Audit Date:** November 17, 2026  
**Auditor:** Senior Real Estate AI Voice Architect & Production Systems Engineer  

---

## 1. EXECUTIVE SUMMARY & REPOSITORY AUDIT

### 1.1 Git Branch and Working Tree Status
- **Current Branch:** `main`
- **Latest Commit SHA:** `e5399cc` (`feat(round6): production validation, acoustic spacing fixes, and audio lifecycle telemetry`)
- **Remote Tracking:** Up to date with `origin/main`
- **Preceding Round Commits:**
  - `f1593a7`: `feat(round5): conversation intelligence, audio cancellation, and voice quality enhancements`
  - `1658cb6`: `feat(branding): complete Workains Reality business identity and multi-builder transformation`
  - `90014b8`: `fix(aria): sanitize agent to Aria and company to Workains Realty, prevent Gemini 400, handle project rejection and Future Estate mapping`
- **Current Working Tree:** Clean (verified via `git status`)

### 1.2 Production PM2 Process Audit (Read-Only)
- **Local Machine:** Windows development environment (`d:\Yuvi\Piyush React\ai_calling`)
- **Production Server:** Linux VPS running PM2 process `1|crm-backend` (NestJS) serving live MCube WebSocket calls on port 5000.
- **Safety Protocol:** Strictly zero destructive PM2 restart/reload actions executed during baseline audit. Production deployment and restart require explicit user approval.

---

## 2. ROOT CAUSE AUDIT: OBSERVED LIVE-CALL STATEMENTS

During live MCube calls (e.g. Call ID `95657630891794910700` and subsequent Round 6 tests), the caller made four critical statements where Aria demonstrated conversational disorientation. Below is the exact source-code path mapping for each utterance:

### Statement 1: *"Nahi usi ke baare mein continue karte hain."*
- **Context:** Agent just recalled the past project Palace Heights: *"Ji, pichhli baar humne Palace Heights ke baare mein baat ki thi! Kya aap iski details dekhna chahte hain ya koi naya project dekhna hai?"* Caller responds: *"Nahi usi ke baare mein continue karte hain."*
- **Exact Source Path:**
  - [call-scripts.ts](file:///d:/Yuvi/Piyush%20React/ai_calling/backend/src/calls/call-scripts.ts#L1000-L1045) -> `resolveContextualShortReply()`:
    - Caller text begins with "Nahi".
    - `isShortDecline()` returns false because word count > 4.
  - [call-scripts.ts](file:///d:/Yuvi/Piyush%20React/ai_calling/backend/src/calls/call-scripts.ts#L1200-L1312) -> `detectIntent()`:
    - Has no intent matcher for "continue current/past project" (`continue_current_project`).
    - Does not qualify as `askingPastProject`, `askingAlternatives`, `isSpecificProject`, or `isGreeting`.
  - [conversation.service.ts](file:///d:/Yuvi/Piyush%20React/ai_calling/backend/src/conversation/conversation.service.ts#L860-L870) -> `reply()`:
    - Injects full `projectsOverview` listing all available properties across all builders (Palace Heights, NCR Monarch, Future Estate, VVIP, Saya).
    - Lacks a `selectedProjectLock` or single-project directive.
    - Gemini LLM sees all projects and assumes the caller declined ("Nahi") rather than affirming "usi ke baare mein", causing the agent to pitch other projects.
- **Verification Status:** `VERIFIED IN SOURCE`

### Statement 2: *"Pehle to?"*
- **Context:** Caller asks a brief follow-up / clarification ("First what?").
- **Exact Source Path:**
  - [call-scripts.ts](file:///d:/Yuvi/Piyush%20React/ai_calling/backend/src/calls/call-scripts.ts#L982-L990) -> `isIncompleteOrAmbiguousQuery()`:
    - Regex only looks for `kya abhi` / `abhi kya`. Does not capture `pehle to` / `pehle to kya`.
  - Falls through to generic follow-up logic [call-scripts.ts](file:///d:/Yuvi/Piyush%20React/ai_calling/backend/src/calls/call-scripts.ts#L1366-L1373), which asks for BHK or offers a site visit instead of referring back to the previously discussed topic.
- **Verification Status:** `VERIFIED IN SOURCE`

### Statement 3: *"Jab maine pehle hi tumse baat kar li hai."*
- **Context:** Returning customer is asked discovery questions about budget/BHK or treated as a fresh lead despite CRM memory.
- **Exact Source Path:**
  - [customer-memory.service.ts](file:///d:/Yuvi/Piyush%20React/ai_calling/backend/src/memory/customer-memory.service.ts#L160-L185) -> `initConversation()` correctly initializes `isReturningCustomer = true`, but in [call-scripts.ts](file:///d:/Yuvi/Piyush%20React/ai_calling/backend/src/calls/call-scripts.ts#L1366-L1372):
    - `nextSampleStep()` defaults to `ask_bhk` if `facts.bhk` is missing from the current call's spoken facts, ignoring persistent customer memory.
    - Agent prompts in [sales-agent-prompt.ts](file:///d:/Yuvi/Piyush%20React/ai_calling/backend/src/conversation/sales-agent-prompt.ts) lacked explicit conversational handling for returning customer acknowledgement when customer reminds Aria of prior talk.
- **Verification Status:** `VERIFIED IN SOURCE`

### Statement 4: *"Kisi ek project ke baare mein to usi ka detail do na, mujhe naya detail kyun de rahe ho?"*
- **Context:** Customer demanded details for one project, but Aria introduced or cited other projects.
- **Exact Source Path:**
  - [conversation.service.ts](file:///d:/Yuvi/Piyush%20React/ai_calling/backend/src/conversation/conversation.service.ts#L862-L870) & [conversation.service.ts](file:///d:/Yuvi/Piyush%20React/ai_calling/backend/src/conversation/conversation.service.ts#L1443-L1570):
    - `getProjectsOverview()` returns multi-project summaries.
    - When the customer is inquiring about a single selected project (e.g., Palace Heights), the prompt does not enforce a `selectedProjectLock`.
    - Gemini LLM compares or introduces alternative projects without the customer explicitly asking for alternatives.
- **Verification Status:** `VERIFIED IN SOURCE`

---

## 3. AUDIT OF INVENTORY AND UNVERIFIED CLAIMS

In the supplied live call logs, Aria cited:
1. `1000 sq.ft.`
2. `₹69 lakh.`
3. `1,50,000 sq.ft. mega luxury clubhouse.`

### Source Inspection & Origin:
- **Location in Code:** [conversation.service.ts](file:///d:/Yuvi/Piyush%20React/ai_calling/backend/src/conversation/conversation.service.ts#L1516-L1520):
  ```typescript
  'saya pre-launch': {
    sizes: '2 BHK (1000 sq.ft, from ₹69L), 2+S BHK (1200 sq.ft), 3 BHK (1400, 1600, 1800 sq.ft), 4 BHK (2600 sq.ft)',
    club: '18 Acres, 17-18 Towers (G+22-25, 2200 units), 1,50,000 sq.ft mega luxury clubhouse, 20*5 payment plan',
    bsp: '₹6,900/sq.ft',
  }
  ```
- **Fallback Projects:** [conversation.service.ts](file:///d:/Yuvi/Piyush%20React/ai_calling/backend/src/conversation/conversation.service.ts#L1544-L1550):
  ```typescript
  name: 'Saya Pre-Launch',
  builder: 'Saya Group',
  startingPrice: 6900000,
  description: '18 Acres, 17-18 Towers, 1,50,000 sq.ft luxury club. 2/3/4 BHK'
  ```
- **Database Schema & Seed Reality:**
  - In [backend/prisma/seed.ts](file:///d:/Yuvi/Piyush%20React/ai_calling/backend/prisma/seed.ts#L41-L88), only two projects are seeded:
    1. `PALACE HEIGHTS BY RUDRA` (Mukesh Khurana / Rudra Buildwell, starting ₹60,90,000, 30,000 sq.ft clubhouse)
    2. `NCR MONARCH` (JSS Buildcon, starting ₹63,99,360)
  - `Saya Pre-Launch` is NOT in the database seed.
  - The `1,50,000 sq.ft mega luxury clubhouse` was hardcoded in `verifiedDetails` and fallback data.
  - When a customer rejected Saya Group, if database projects cache expired or was bypassed, `Saya Pre-Launch` could leak through fallback or hardcoded text.
  - Furthermore, reciting "1,50,000 sq.ft mega luxury clubhouse" violates strict inventory rules against reciting unverified superlatives without source database verification.
- **Verification Status:** `VERIFIED IN SOURCE`

---

## 4. AUDIT OF TTS NUMBER NORMALIZATION

### 4.1 Comma Splitting Bug on Large Numbers
- **Observed Behavior:** Spoken output for `1,50,000 sq.ft.` produced `1, 50000 square feet .`
- **Root Cause:**
  - In [phone-audio.ts](file:///d:/Yuvi/Piyush%20React/ai_calling/backend/src/calls/phone-audio.ts#L294):
    ```typescript
    s = s.replace(/\b([0-9]{1,2}),([0-9]{3})\s*(?:sq\.?\s*ft\.?|sqft|square\s*feet)\b/gi, ' $1$2 square feet ');
    ```
    This regex only matches a single comma group (`1,250`).
    For `1,50,000`, the first comma group `1,` is left untouched, and only `50,000 sq.ft.` is converted to `50000 square feet`.
    The leading `1,` is left hanging with a comma, causing ElevenLabs TTS to pause and say: *"One, fifty thousand square feet"*.
- **Verification Status:** `VERIFIED IN SOURCE` (Reproduced directly in Node runtime test)

### 4.2 Spacing & Word Boundaries
- Currency normalizations for `₹60.90 lakh`, `₹63.99 lakh`, `₹86.32 lakh`, `₹69 lakh`, `₹8,888/sq.ft`, and `2 BHK` were enhanced in Round 6, but large Indian numbering system values (`1,50,000`, `1.5 lakh`) need comprehensive regex support.
- **Verification Status:** `PARTIALLY VERIFIED`

---

## 5. AUDIT OF BARGE-IN & TELEMETRY LIFECYCLE

### 5.1 Current Implementation vs Required 9 States
- Current state in [mcube-stream.service.ts](file:///d:/Yuvi/Piyush%20React/ai_calling/backend/src/calls/mcube-stream.service.ts#L173-L205) logs 6 steps.
- Round 7 requires 9 discrete, auditable lifecycle states:
  1. `BARGE_IN_DETECTED`
  2. `CLEAR_COMMAND_SENT`
  3. `LOCAL_QUEUE_CLEARED`
  4. `LLM_GENERATION_ABORTED`
  5. `TTS_GENERATION_ABORTED`
  6. `LAST_AUDIO_CHUNK_SENT`
  7. `MCUBE_ACK_RECEIVED`
  8. `CARRIER_DRAIN_STATUS`
  9. `NEXT_CUSTOMER_RESPONSE_STARTED`
- Differentiating between carrier explicit ACK (`MCUBE_ACK_RECEIVED`) and inferred stream drain (`CARRIER_DRAIN_STATUS`) is essential to prevent false claims that carrier audio has stopped.
- **Verification Status:** `PARTIALLY VERIFIED`

---

## 6. AUDIT OF PRODUCTION VERSION IDENTIFICATION

- Currently, call session logs in `McubeStreamService` log `callId` and `streamId`, but do NOT log `APP_VERSION`, `GIT_COMMIT_SHA`, `DEPLOYMENT_ID`, or `PROCESS_PID`.
- A dedicated version tracking module is needed so every call log explicitly reveals the running Git commit and software version.
- **Verification Status:** `NOT VERIFIED` (To be implemented in Round 7)

---

## 7. AUDIT OF WHATSAPP WORKFLOW

- In [whatsapp.service.ts](file:///d:/Yuvi/Piyush%20React/ai_calling/backend/src/whatsapp/whatsapp.service.ts#L151-L157), `read` webhook status was collapsed into `'DELIVERED'`.
- Section 10 requires Aria and the system to distinguish:
  `REQUESTED` -> `INITIATED` -> `SENT` -> `DELIVERED` -> `READ` -> `FAILED`.
- The system must never claim delivery when only an API request was submitted.
- **Verification Status:** `PARTIALLY VERIFIED`

---

## 8. BASELINE AUDIT MATRIX

| Area | Observed Live Issue / Requirement | Current Implementation Status | Classification |
|---|---|---|---|
| Project Continuity | Customer says *"Nahi usi ke baare mein continue karte hain"* | No context lock; injects all projects; LLM switches project | `FAILED` in live call; `VERIFIED IN SOURCE` |
| Project Context Lock | Customer asks *"Usi ka detail do na, mujhe naya detail kyun de rahe ho?"* | No `selectedProjectLock` enforcing single project focus | `FAILED` in live call; `VERIFIED IN SOURCE` |
| Verified Project Facts | Spoken: 1000 sq.ft, ₹69L, 1,50,000 sq.ft mega clubhouse | Hardcoded in `verifiedDetails` & fallback; not verified in DB | `VERIFIED IN SOURCE` |
| TTS Number Pronunciation | `1,50,000 sq.ft.` pronounced with hanging comma | Regex handles 1 comma, fails on Indian 2-comma `1,50,000` | `VERIFIED IN SOURCE` |
| Barge-in Lifecycle | 9 distinct telemetry states | 6 states logged; missing discrete LLM vs TTS abort & ACK vs drain | `PARTIALLY VERIFIED` |
| Production Versioning | Git commit SHA & app version in call logs | Missing from call session logs | `NOT VERIFIED` |
| WhatsApp Workflow | Multi-state verification (requested -> read) | `read` mapped to `DELIVERED`; distinct `READ` state missing | `PARTIALLY VERIFIED` |

---
*Baseline audit complete. Proceeding to implementation of Round 7 fixes without altering core architecture.*

