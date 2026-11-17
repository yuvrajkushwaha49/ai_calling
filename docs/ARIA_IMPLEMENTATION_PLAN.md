# Aria Real Estate AI Voice Calling CRM — Implementation Plan

**Date:** 2026-11-17  
**Objective:** Upgrade Aria Voice Calling CRM into an intelligent, context-aware, natural-sounding Real Estate Sales Advisor without rewriting the application or breaking existing integrations.

---

## 1. Architectural Strategy & Guarantees

1. **Zero Architecture Disruption:**
   - Preserve existing NestJS module hierarchy, Prisma schema, Redis keys, MCube bidirectional WebSocket, and frontend React UI.
   - Do not replace ElevenLabs or Gemini providers.
   - Retain 8kHz μ-law audio formats.
2. **Backward Compatibility:**
   - All enhancements to memory types and service signatures will be additive and optional.
   - Database tables (`Lead`, `Call`, `ConversationMemory`, `Project`, `Appointment`) require no breaking schema migrations.
3. **Safety & Stability:**
   - Preserve all existing 60+ unit tests across the test suites.
   - Add new targeted test suites for all 15 scenarios specified in Part 13.

---

## 2. Phase-by-Phase Roadmap

```mermaid
flowchart LR
    Phase1[Phase 1: Conversation Intelligence] --> Phase2[Phase 2: Customer Memory Engine]
    Phase2 --> Phase3[Phase 3: Smart Anti-Repetition & Validation]
    Phase3 --> Phase4[Phase 4: Direct Question Answering & Dialogue Flow]
    Phase4 --> Phase5[Phase 5: Real Estate Sales & Inventory Matching]
    Phase5 --> Phase6[Phase 6: Audio Queue & CRM Automation]
    Phase6 --> Validation[Regression & Integration Testing]
```

---

### Phase 1: Conversation Intelligence Engine (Part 3)
* **Goal:** Enable dynamic intent classification, topic switching, and dynamic next-question determination based on known vs missing facts.
* **Files Affected:**
  - `backend/src/memory/memory.types.ts`: Define `MissingFact`, `NextAction`, `EnhancedCustomerFacts`.
  - `backend/src/conversation/conversation.service.ts`: Update prompt builder to inject structured `knownFacts`, `missingFacts`, and `nextAction`.
  - `backend/src/calls/call-scripts.ts`: Update intent detection to support clarification, direct question answering, and topic shifts.

---

### Phase 2: Customer Memory Engine (Part 4)
* **Goal:** Enhance `CustomerMemoryService` to distinguish historical from current-call facts, track fact sources (`previous_call`, `current_call`, `crm`), detect information corrections, and persist cleanly to DB and Redis.
* **Files Affected:**
  - `backend/src/memory/customer-memory.service.ts`:
    - Enrich `initializeCallMemory` to stamp `source: 'previous_call'` on loaded facts.
    - Enrich `applyExtractedFacts` to detect corrections, log previous values, and stamp `source: 'current_call'`.
    - Provide `getFactContext(callId)` returning `{ knownFacts, missingFacts, nextAction }`.
  - `backend/src/memory/fact-extractor.service.ts`:
    - Improve budget and location update detection when customer says "Actually mera budget badh gaya hai" or "Nahi mujhe Noida Expressway par chahiye".

---

### Phase 3: Smart Anti-Repetition & Validation Engine (Part 5)
* **Goal:** Upgrade `QuestionValidatorService` so it never discards valuable response content or replaces valid replies with unrelated canned questions.
* **Files Affected:**
  - `backend/src/memory/question-validator.service.ts`:
    - Instead of replacing the whole sentence, strip only the repeated question clause.
    - If the response is purely an answer or information, preserve it 100%.
    - If a replacement question is needed, select dynamically from the call's `missingFacts` in context of the customer's latest topic.

---

### Phase 4: Direct Question Answering & Natural Dialogue (Part 6 & Part 8)
* **Goal:** Enforce strict priority: Direct Answer -> Intent Ack -> Missing Qualification -> Property Match -> Visit Conversion.
* **Files Affected:**
  - `backend/src/conversation/conversation.service.ts`:
    - Add direct answering rules into prompt: When customer asks "Tumhe kaise pata chala mera budget 80 lakh hai?", answer directly from conversation history.
    - Prevent repetitive name addressing (e.g. max once per 2-3 turns).
    - Ensure natural Hindi/Hinglish flow.

---

### Phase 5: Real Estate Sales Intelligence & Inventory Matching (Part 7)
* **Goal:** Accurate property matching using verified CRM inventory; separate residential vs commercial; never invent projects.
* **Files Affected:**
  - `backend/src/conversation/conversation.service.ts`:
    - Format `getProjectsOverview()` categorized into **Residential Projects** and **Commercial Projects** with starting prices.
    - Provide clear guidelines to recommend residential projects for residential requirements, and commercial (Saya Piazza, Saya South X) for commercial requirements.
  - `backend/src/appointments/appointments.service.ts`:
    - Confirm site visits only when customer explicitly specifies interest and a tentative date/time slot.

---

### Phase 6: Voice, Audio Queue & CRM Automation (Part 9, 10, 11, 12)
* **Goal:** Robust barge-in queue cancellation, structured turn logging, and clean CRM updates.
* **Files Affected:**
  - `backend/src/calls/mcube-stream.service.ts`:
    - Ensure barge-in invalidates pending TTS promises and sends `clearAudio`.
    - Structured turn logging (Turn count, latency, intent, memory state).
  - `backend/src/calls/twilio-stream.service.ts`:
    - Parity with MCube stream handling.

---

## 3. Testing & Verification Plan

1. **Automated Test Scenarios (Part 13):**
   - Create `backend/src/conversation/aria-intelligence.spec.ts` covering all 15 scenarios (Returning customer, budget update, ready-to-move, direct question, topic switch, anti-repetition, residential vs commercial, site visit refusal, unverified inventory, etc.).
2. **Regression Testing:**
   - Execute all 8 existing test suites (`npm --prefix backend test`).
3. **Build Verification:**
   - Verify zero TypeScript compiler errors (`npm --prefix backend run build`).
