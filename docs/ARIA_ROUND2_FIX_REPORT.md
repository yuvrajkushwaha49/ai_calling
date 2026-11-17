# Aria Round 2 Live Call Fix Implementation Report

## Overview

This report documents the architectural improvements, code changes, and test results implemented to resolve the 7 live call regression issues identified in the Round 2 MCube live audit.

---

## 1. Technical Changes Implemented

### 1.1 Strict Budget Matching (`backend/src/conversation/conversation.service.ts`)
- **Customer Budget Extraction:** Evaluates customer budget from `options.memory.customer.budget`, `options.lead.budget`, or `known.budgetLabel`.
- **Dynamic Inventory Bucketing:**
  - `[VERIFIED IN-BUDGET RESIDENTIAL PROPERTIES (<= ₹X Lakh) - RECOMMEND FIRST]`
  - `[STRETCH-BUDGET RESIDENTIAL PROPERTIES (> ₹X Lakh) - STRICT RULE: DISCLOSE PRICE DIFFERENCE UPFRONT & ASK PERMISSION BEFORE DISCUSSING]`
- **Stretch Price Notice:** Computes exact difference in Lakhs (e.g., `+₹6 Lakh above customer's budget`, `+₹11 Lakh above customer's budget`).
- **Prompt Rules:** Mandates recommending in-budget options first and asking customer permission before detailing stretch properties.

### 1.2 Floor Plan & Unit Size Query Resolution (`backend/src/conversation/conversation.service.ts`)
- **Query Detection:** Added `asksFloorPlanOrSize` regex matching `size`, `sizes`, `area`, `sqft`, `layout`, `floor plan`, and `map`.
- **Configuration Sizes Embedded:**
  - **Palace Heights:** 1 BHK (700 sq.ft, from ₹60.9L furnished), 2 BHK (1015-1088 sq.ft), 3 BHK (1341-1568 sq.ft), 4 BHK (1841-2285 sq.ft).
  - **NCR Monarch:** 1 BHK (720-1010 sq.ft, from ₹64L), 2 BHK (1075-1255 sq.ft), 3 BHK (1345-1810 sq.ft).
  - **Saya Pre-Launch:** 2 BHK (1000 sq.ft, ₹69L), 2+S BHK (1200 sq.ft), 3 BHK (1400, 1600, 1800 sq.ft), 4 BHK (2600 sq.ft).
  - **Future Estate:** 2 BHK (1110, 1130, 1170, 1240 sq.ft, from ₹86.3L), 2 BHK+Study (1335 sq.ft), 3 BHK (2050 sq.ft), 4 BHK (2500 sq.ft).
  - **VVIP Pre-Launch:** 2 BHK (1250 sq.ft, ~₹90.6L), 3 BHK (1800 sq.ft), 4 BHK (2400 sq.ft).
- **Priority Rule:** Unit size answers must never be deflected into a site visit pitch.

### 1.3 Verified Project Data & Anti-Hallucination (`backend/src/conversation/conversation.service.ts`)
- Cross-verified against `backend/scripts/reset-and-seed-projects.js`.
- VVIP Pre-Launch verified: 5 Acres, 5 Towers, G+30 floors, 750 units, 4 lifts/floor, 60,000 sq.ft modern clubhouse, starting ₹90.6 Lakh (₹7,250/sq.ft).
- Prompt instruction: Unverified fittings or amenities (e.g. modular kitchen brand, balcony fittings) must trigger an offer for team follow-up rather than guessing.

### 1.4 WhatsApp Module & Status Tracking (`backend/src/whatsapp/`)
- Created `WhatsAppService` and `WhatsAppModule` with status tracking: `QUEUED`, `SENT`, `DELIVERED`, `FAILED`, and `UNAVAILABLE`.
- Conversational safe disclaimer: *"Main team ko note karwa deti hoon, wo details aur layout verify karke aapke WhatsApp number par share kar denge."*
- Registered `WhatsAppModule` into `backend/src/app.module.ts`.

### 1.5 Canonical Response Parity & Logging Fix (`backend/src/conversation/conversation.service.ts`)
- In `ConversationService.reply()`, line 1185:
  ```typescript
  // Before:
  if (previousAgent && isSameTalk(replyText, previousAgent)) {
    const fallback = buildFollowUpReply(...);
    replyText = fallback.text;
  }

  // After:
  if (!streamed && previousAgent && isSameTalk(replyText, previousAgent)) {
    const fallback = buildFollowUpReply(...);
    replyText = fallback.text;
  }
  ```
- Ensures that when audio is streamed token-by-token to TTS, the logged and returned response is identical to what was spoken.

### 1.6 Latency Optimization & Instrumentation (`backend/src/llm/llm.service.ts` & `mcube-stream.service.ts`)
- **Cleaned Model Candidates:** Removed non-existent models `gemini-3.5-flash` and `gemini-3.6-flash`.
- **In-Memory Cache:** `getCachedProjects()` caches CRM projects for 5 minutes (`300_000ms`), avoiding repeated DB queries per turn.
- **Granular Latency Telemetry:**
  ```text
  [MCube] ⚡ Latency Metrics: STT=Xms, LLM_first_token=Xms, LLM_first_sentence=Xms, TTS_first_audio=Xms, LLM_total=Xms, Turn_total=Xms
  ```

### 1.7 Contextual First-Turn Opener (`backend/src/calls/mcube-stream.service.ts`)
- Replaced isolated "Hello?" with contextual opener:
  - **Returning Customer:** *"Namaste [Name] ji! Main Aria, Saya Group se bol rahi hoon. Pichhli baar hamari baat [pastReq] ko lekar hui thi. Kya aaj usi ko continue karein?"*
  - **New Customer:** *"Namaste ji! Main Aria, Saya Group se bol rahi hoon. Aapki property requirement ke baare mein baat kar sakti hoon?"*
- Stored into `session.transcript` and `CustomerMemoryService` turn history to prevent repeated greetings.

---

## 2. Test Verification Matrix

| Fix Area | Verification Method | Result | Classification |
| :--- | :--- | :--- | :--- |
| **Strict Budget Matching** | `aria-round2-regression.spec.ts` (Test 1.1, 1.2) | PASS | `VERIFIED BY AUTOMATED TEST` |
| **Floor Plan & Sizes** | `aria-round2-regression.spec.ts` (Test 2.1, 2.2) | PASS | `VERIFIED BY AUTOMATED TEST` |
| **Verified Project Data** | `aria-round2-regression.spec.ts` (Test 3.1, 3.2) | PASS | `VERIFIED BY AUTOMATED TEST` |
| **WhatsApp Service & Status** | `aria-round2-regression.spec.ts` (Test 4.1, 4.2) | PASS | `VERIFIED BY AUTOMATED TEST` |
| **Canonical Response Parity** | `aria-round2-regression.spec.ts` (Test 5.1) | PASS | `VERIFIED BY AUTOMATED TEST` |
| **Latency & DB Cache** | `aria-round2-regression.spec.ts` (Test 6.1) | PASS | `VERIFIED BY AUTOMATED TEST` |
| **Contextual Opener** | `aria-round2-regression.spec.ts` (Test 7.1, 7.2) | PASS | `VERIFIED BY AUTOMATED TEST` |
| **Round 1 Critical Fixes** | `aria-critical-fixes.spec.ts` (12 tests) | 12/12 PASS | `VERIFIED BY AUTOMATED TEST` |
| **Full Backend Suite** | `jest` (12 test suites, 103 total tests) | 103/103 PASS | `VERIFIED BY AUTOMATED TEST` |
| **Production Build** | `nest build` | Code 0 (Success) | `VERIFIED IN SOURCE` |
| **Live MCube Telephony** | End-to-end outbound/inbound phone call | Ready for test | `PENDING LIVE CALL SESSION` |
