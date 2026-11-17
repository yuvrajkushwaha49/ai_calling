# ARIA CRITICAL FIX IMPLEMENTATION REPORT

**Date:** 2026-11-17  
**Project:** Aria AI Voice Calling CRM — Saya Group Real Estate  
**Status:** IMPLEMENTED, TESTED, VERIFIED  

---

## 1. Overview of Fixes Implemented

All reported P0 and P1 issues have been addressed in code, verified with unit tests, and built cleanly.

---

## 2. Detailed Technical Fixes

### 2.1 P0: Appointment Booking Safety
* **Files Modified:**
  - `backend/src/appointments/meeting-time.ts`
  - `backend/src/appointments/appointments.service.ts`
* **Changes:**
  1. Added `isGenericAcknowledgement(text: string)`: Detects generic acknowledgements like "ठीक है", "हाँ", "अच्छा", "सही है", "ok", "okay", "sure", "bilkul".
  2. Added `isExplicitMeetingConfirmation(text: string)`: Requires explicit confirmation phrases like "confirm kar do", "book kar do", "lock kar do".
  3. Added `isDateExplicit: boolean` and `isTimeExplicit: boolean` flags to `ParsedMeetingSlot`.
  4. In `maybeBookFromCall`:
     - Rejects any turn containing only a generic acknowledgement (`reason: 'generic_acknowledgement'`).
     - Returns `reason: 'missing_time'` if the customer specifies a day (e.g., Saturday) without an explicit time.
     - Returns `reason: 'missing_date'` if time is given without a date.
     - Detects existing active appointments (`AppointmentStatus.SCHEDULED`) for the same customer: updates the appointment if rescheduled; returns `already_exists` if identical slot is re-submitted.
     - Removed automatic defaulting to 11:00 AM.

### 2.2 P0: Google Calendar Failure Handling
* **Files Modified:**
  - `backend/src/google-calendar/google-calendar.service.ts`
  - `backend/src/appointments/appointments.service.ts`
* **Changes:**
  1. Created structured `CalendarEventResult` interface with `success`, `eventId`, `htmlLink`, `errorCode`, and `errorMessage`.
  2. Identified `invalid_grant` specifically: logs `[GoogleCalendar] 🚨 AUTHENTICATION FAILED: invalid_grant detected — OAuth refresh token invalid or revoked`. Skips retries immediately on auth failure.
  3. Implemented safe retry loop (max 2 retries, 500ms delay with exponential backoff) only for transient network/server errors (`ETIMEDOUT`, `ECONNRESET`, 500/502/503).
  4. In `appointments.service.ts`:
     - Database record created independently with `status: SCHEDULED`.
     - On calendar sync failure, appends `[Calendar Sync Status: FAILED - ${cal.errorCode}]` to appointment `notes`.
     - `confirmationLine()`: If `!booking.calendarSynced`, agent speaks: *"मैंने आपकी मीटिंग [date] को [time] पर नोट कर ली है।"* (never claims it was added to Google Calendar).

### 2.3 P0: Customer Intent and Question Handling
* **Files Modified:**
  - `backend/src/calls/call-scripts.ts`
  - `backend/src/conversation/conversation.service.ts`
* **Changes:**
  1. Added `isIncompleteOrAmbiguousQuery(text: string)` in `call-scripts.ts`: Detects short fragments like "क्या अभी?", "अभी?", "kya abhi", "matlab?", "kyun?".
  2. Updated `detectIntent`:
     - Sets `incompleteOrAmbiguous: true`.
     - Sets `positive: false` when query is ambiguous or a generic acknowledgement.
  3. Added `clarify_ambiguous` reply kind in `buildFollowUpReply`:
     - Responds: *"जी, क्या आप अभी साईट विज़िट के लिए पूछ रहे हैं, या अभी कॉल पर बात करने के लिए?"*
  4. Updated `ConversationService` (`quickSystem` and `system` prompts):
     - Priority 1: Directly answers caller queries first. If caller asks "क्या अभी?", clarifies immediately.
     - Topic Switch: Immediately abandons site visit pitch and answers customer questions if they change topics.

### 2.4 P0: Budget & Inventory Matching
* **Files Modified:**
  - `backend/src/conversation/conversation.service.ts`
* **Changes:**
  1. Strict Budget Transparency Rule: Prompt strictly mandates comparing stated customer budget against verified CRM inventory.
  2. Transparent Disclosure Requirement: Prohibits pitching properties above budget without upfront disclosure. Must say: *"Yeh option aapke ₹80 lakh budget se thoda sa upar hai, ₹86 lakh se shuru hota hai. Kya aap iska layout dekhna chahenge?"*
  3. Customer Permission: AI must ask customer permission before pitching stretch options.
  4. Residential vs Commercial Segregation: For residential requirements (flats/apartments/BHK), commercial projects (Saya Piazza, Saya South X retail shops) are strictly forbidden unless caller explicitly asks for commercial/shops. If intent is ambiguous (e.g. "investment"), clarifies first.

### 2.5 P1: Audio & WebSocket Lifecycle
* **Files Modified:**
  - `backend/src/calls/mcube-stream.service.ts`
* **Changes:**
  1. In `ws.on('close')`:
     - Sets `session.closed = true`, `session.cancelPlay = true`, `session.agentPlaying = false`.
     - Increments `session.flushGen += 1` to abort pending async TTS and LLM tasks.
     - Clears `session.rawChunks = []` and `session.pendingSegments.clear()`.
     - Persists customer memory to DB immediately (`customerMemory.persistMemoryToDb`).
  2. In `sendPlayAudio`:
     - Validates `if (ws.readyState !== ws.OPEN || !session.streamId || session.closed || session.cancelPlay) return;`
  3. In `bargeIn`:
     - Sets `session.cancelPlay = true`, `session.agentPlaying = false`, `session.flushGen += 1`, clears pending segments, and sends `clearAudio` immediately.

### 2.6 P1: Anti-Repetition & Logging Disparity
* **Files Modified:**
  - `backend/src/calls/mcube-stream.service.ts`
* **Changes:**
  1. Added `spokenValidatedSentences: string[] = []` accumulator in `flushTurn`.
  2. In `onSentence`: Each sanitized sentence (`validatedSentence`) is pushed to `spokenValidatedSentences`.
  3. Turn Resolution:
     - Sets `replyText = spokenValidatedSentences.join(' ')`.
     - If non-streaming fallback was used, sanitizes `result.replyText` through `questionValidator.validateAndSanitize` before logging.
  4. Result: `session.lastAgentText`, `session.transcript`, Turn log (`[MCube] 💬 Turn #... AI: "${replyText}"`), and `customerMemory.recordTurn` now record the exact canonical spoken response.

### 2.7 P1: Response Latency Optimization & Granular Metrics
* **Files Modified:**
  - `backend/src/calls/mcube-stream.service.ts`
* **Changes:**
  1. Granular Latency Telemetry added:
     - `sttDurationMs`: Accurate speech-to-text latency.
     - `llmFirstTokenMs`: Time from LLM request to first token/sentence.
     - `ttsFirstAudioMs`: Time from LLM start to first synthesized audio chunk.
     - `llmTotalMs`: Total LLM stream completion time.
     - `turnTotalMs`: Total turn round-trip time.
  2. Live Telemetry Logging:
     `[MCube] ⚡ Latency Metrics: STT=${sttDurationMs}ms, LLM_first=${llmFirstTokenMs}ms, TTS_first_audio=${ttsFirstAudioMs}ms, LLM_total=${llmTotalMs}ms, Turn_total=${turnTotalMs}ms`

---

## 3. Automated Verification Results

Automated test suite `backend/src/conversation/aria-critical-fixes.spec.ts` executed with 12/12 passing tests:
- Scenario 1 (Auto-booking on "ठीक है" prevented): **PASS**
- Scenario 2 (Date without explicit time asks follow-up): **PASS**
- Scenario 3 (Explicit date and time slot parsed): **PASS**
- Scenario 4 (Date change reschedules existing appointment): **PASS**
- Scenario 5 (Google Calendar `invalid_grant` handled cleanly): **PASS**
- Scenario 6 ("क्या अभी?" clarified directly, no booking): **PASS**
- Scenario 7 (Budget transparency instructions enforced): **PASS**
- Scenario 8 (Generic acknowledgement mid-call does not advance visit): **PASS**
- Scenario 9 (WebSocket disconnect cancels pending audio): **PASS**
- Scenario 10 (Barge-in clears pending segments & sends `clearAudio`): **PASS**
- Scenario 11 (Anti-repetition sanitizes repeated questions): **PASS**
- Scenario 12 (Duplicate booking prevention): **PASS**

Full suite: **11 test suites passed, 91 tests passed**.  
Build: **NestJS production build succeeded with exit code 0**.

