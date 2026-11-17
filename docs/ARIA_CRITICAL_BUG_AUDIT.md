# ARIA LIVE PRODUCTION BUG AUDIT REPORT

**Date:** 2026-11-17  
**Project:** Aria AI Voice Calling CRM — Saya Group Real Estate  
**Telephony Provider:** MCube Bidirectional Audio WebSocket (audio/x-mulaw @ 8000Hz)  
**Author:** Senior NestJS Backend Architect & Conversational AI Engineer  

---

## 1. Executive Summary

Following real MCube production call log analysis, five critical P0 and three P1 production bugs were identified in the live telecalling pipeline. This audit documents the exact line-by-line root causes across appointment scheduling, Google Calendar synchronization, intent handling, inventory matching, audio stream lifecycle, anti-repetition logging, and latency bottlenecks.

---

## 2. P0 Bug Root Cause Analysis

### 2.1 P0 — Appointment Booking Safety
* **Reported Symptom:** Customer says only "ठीक है", and AI automatically schedules a site visit on Saturday at 11:00 AM.
* **Root Cause Location:** `backend/src/appointments/meeting-time.ts` (lines 357–362 & 461–468) and `backend/src/appointments/appointments.service.ts` (lines 140–155).
* **Detailed Trace:**
  1. In `meeting-time.ts`, when `parseMeetingSlot` encountered a customer utterance following an agent question mentioning "weekend" or "visit", the fallback logic matched the prior agent question rather than requiring explicit customer intent.
  2. If the user said "ठीक है", `WEEKEND_RE.test(priorTail)` evaluated to true. Because the customer gave no explicit time or date, the code assigned default values: `hm = '11:00 AM'` and defaulted the date to the upcoming Saturday.
  3. In `appointments.service.ts`, `maybeBookFromCall` did not filter out generic acknowledgements ("ठीक है", "हाँ", "अच्छा", "ok"), leading to unauthorized bookings.

### 2.2 P0 — Google Calendar Failure Handling
* **Reported Symptom:** Google Calendar API returns `invalid_grant`, yet the CRM still reports the appointment as successfully booked and claims to the customer that it was added to the calendar.
* **Root Cause Location:** `backend/src/google-calendar/google-calendar.service.ts` (lines 160–185) and `backend/src/appointments/appointments.service.ts` (lines 190–215, 375–389).
* **Detailed Trace:**
  1. `googleCalendar.createEvent` caught OAuth refresh errors (`invalid_grant`), logged a warning, and returned `null`.
  2. In `appointments.service.ts`, the database appointment record was created with `status = SCHEDULED` before calendar sync. Because `googleEventId` was simply omitted when `cal` was null, the system lacked a separate synchronization failure state.
  3. `confirmationLine()` previously did not distinguish between a DB-only booking and a synchronized calendar booking, telling the caller in Hindi: *"मैंने आपकी मीटिंग ... calendar में सेट कर दी है"* even when the token was invalid or sync failed.

### 2.3 P0 — Customer Intent and Question Handling
* **Reported Symptom:** Customer asked "क्या अभी?" (inquiring if the site visit or discussion can happen right now), but the AI ignored the question and continued with weekend site-visit scheduling.
* **Root Cause Location:** `backend/src/calls/call-scripts.ts` (`detectIntent` lines 1238–1244 and `buildFollowUpReply` lines 1346–1358) and `backend/src/conversation/conversation.service.ts` (`quickSystem` lines 1020–1045).
* **Detailed Trace:**
  1. "क्या अभी?" was not recognized as an incomplete question fragment or clarifying inquiry. In `detectIntent`, it did not trigger `callback`, `notInterested`, or `askingPrice`.
  2. Because the agent's prior question was "Kya aap weekend site visit plan karenge?", the script's `already.offeredVisit` was `true`. In the script fallback `nextSampleStep()`, the flow defaulted to `confirm_followup`, generating: *"Next weekend note kar liya — visit se pehle reminder call kar leti hoon"*.
  3. The prompt lacked explicit few-shot instructions to clarify ambiguous timing fragments like "क्या अभी?".

### 2.4 P0 — Budget & Inventory Matching
* **Reported Symptom:** Customer stated a budget of ₹80 Lakh. The AI pitched Saya South X / Zion with a starting price of ₹86 Lakh without transparently disclosing that it exceeded the customer's budget.
* **Root Cause Location:** `backend/src/conversation/conversation.service.ts` (`quickSystem` prompt lines 1016–1040).
* **Detailed Trace:**
  1. The live prompt provided `AVAILABLE PROJECTS & INVENTORY`, but lacked an explicit constraint demanding transparent disclosure before pitching properties that exceed stated budgets.
  2. The LLM assumed ₹86 Lakh was "close enough" to ₹80 Lakh, failing to ask permission or disclose the gap ("Yeh option aapke budget se thoda sa upar hai, ₹86 lakh se shuru hota hai. Kya aap dekhna chahenge?").
  3. Lack of explicit residential vs commercial intent gating allowed commercial retail units to be pitched to residential flat seekers.

---

## 3. P1 Bug Root Cause Analysis

### 3.1 P1 — Audio & WebSocket Lifecycle
* **Reported Symptom:** Hanging TTS tasks and uncancelled LLM generations sending audio after callers hung up or barged in.
* **Root Cause Location:** `backend/src/calls/mcube-stream.service.ts` (`ws.on('close')` lines 443–455, `sendPlayAudio` lines 933–965, and `bargeIn` lines 161–175).
* **Detailed Trace:**
  1. `ws.on('close')` did not set `session.cancelPlay = true` or increment `session.flushGen`, leaving in-flight asynchronous TTS synthesis chains running.
  2. `sendPlayAudio` only checked `ws.readyState !== ws.OPEN`. If the socket closed while audio was being synthesized, buffered chunks could attempt transmission or cause socket write warnings.

### 3.2 P1 — Anti-Repetition & Logging Disparity
* **Reported Symptom:** Anti-repetition sanitizer properly cleans the spoken sentence for TTS, but the raw, unsanitized LLM output is what gets recorded in Conversation Reply and Turn logs.
* **Root Cause Location:** `backend/src/calls/mcube-stream.service.ts` (lines 722–735, 763–766, 818–830).
* **Detailed Trace:**
  1. `onSentence(sentence)` sanitized the streamed sentence into `validatedSentence` and fed it to TTS.
  2. After streaming concluded, `replyText = result.replyText.trim()`, where `result.replyText` was the raw, unsanitized LLM output.
  3. Turn logs, `session.lastAgentText`, `session.transcript`, and `customerMemory.recordTurn` all stored `replyText`, recording repeated questions even though the customer heard the sanitized version.

### 3.3 P1 — Response Latency Breakdown (9,268ms Turn)
* **Reported Symptom:** Production logs revealed a turn taking 9,268ms from caller speech end to turn completion.
* **Root Cause Location:** Turn log timing recorded full sequential TTS queue completion (`await ttsChain`) across 3 full sentences rather than first-audio delivery, compounded by lack of granular metric breakdowns (STT vs LLM-first vs TTS-first).

---

## 4. Audit Summary Matrix

| Issue Area | Severity | Affected Services | Resolution Status |
|---|---|---|---|
| Auto-Booking on "ठीक है" | P0 | `meeting-time.ts`, `appointments.service.ts` | FIXED & TESTED |
| Google Calendar `invalid_grant` | P0 | `google-calendar.service.ts`, `appointments.service.ts` | FIXED & TESTED |
| Customer Intent "क्या अभी?" | P0 | `call-scripts.ts`, `conversation.service.ts` | FIXED & TESTED |
| Budget Match ₹80L vs ₹86L | P0 | `conversation.service.ts` | FIXED & TESTED |
| WebSocket & Barge-In Cleanup | P1 | `mcube-stream.service.ts` | FIXED & TESTED |
| Anti-Repetition Log Disparity | P1 | `mcube-stream.service.ts` | FIXED & TESTED |
| Granular Latency Telemetry | P1 | `mcube-stream.service.ts` | FIXED & TESTED |
