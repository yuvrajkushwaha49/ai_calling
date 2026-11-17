# Workains Reality — Aria Round 5: Root Cause Audit

**Audit Date:** 17 November 2026  
**Auditor:** Senior Real Estate Voice AI Architect  
**Subject:** Real MCube Production Call & System Behavior Analysis  
**Overall Status:** COMPLETED & VERIFIED IN SOURCE

---

## 1. Executive Summary

Production testing and real MCube call recordings revealed several critical behavioral, conversational, and acoustic regressions in Aria (Workains Reality AI Sales Advisor):
1. **Persistent Preference Amnesia:** Customers rejecting specific builders (such as Saya Group) in prior turns or calls were re-recommended projects from those builders in subsequent calls.
2. **Artificial Inventory Truncation:** When asked for all available inventory (*"Sab projects batao"*), Aria only returned a hardcoded 3-item list or omitted active projects like Future Estate and VVIP Pre-Launch.
3. **Barge-in Audio Bleed:** When customers interrupted the AI, stale audio chunks already scheduled in the queue continued playing over telephony or restarted after the interrupt.
4. **Sentence & Decimal TTS Fragmentation:** Numbers with decimals (e.g. `₹60.9 Lakh`, `₹63.99 Lakh`) and abbreviations (`sq.ft`) were split across sentence boundaries into separate audio requests, causing jarring acoustic pauses (`"Isme 2 BHK price 63." ... "99 Lakh..."`).
5. **WhatsApp Delivery Misrepresentation:** WhatsApp disclaimers did not cleanly differentiate between successful API dispatches and offline/unconfigured queue fallbacks.

---

## 2. Root Cause Breakdown

### Issue 1: Customer Rejected Builder Re-Recommended (Saya Group Re-Pitch)
- **Status:** `VERIFIED IN SOURCE` & `VERIFIED BY AUTOMATED TEST`
- **Symptom:** In live calls, a customer explicitly said *"Saya group mujhe pasand nahi hai"* or *"Saya ke alawa aur koi options hain kya?"*. In a later turn or follow-up call, Aria suggested *Saya Pre-Launch*.
- **Root Cause Analysis:**
  1. **Prompt Hardcoding:** In `backend/src/conversation/conversation.service.ts`, the static fallback prompt contained a hardcoded list: `1. Saya Pre-Launch (Raj Nagar Extension) from ₹69 Lakh`. Even when memory knew Saya was rejected, the LLM system prompt explicitly instructed it with that catalog snippet.
  2. **DB Preference Drop:** In `backend/src/memory/customer-memory.service.ts`, `fetchCustomerProfileFromDb()` only queried the `Lead` record, ignoring historical `ConversationMemory` records where `rejectedBuilders` were persisted. On Redis cache misses or expiration, customer preferences reverted to empty arrays (`[]`).
  3. **Fact Extraction Regex Vulnerability:** `FactExtractorService.extractBuilders()` only matched negative phrases strictly adjacent to builder names (`^/nahi/`). Natural phrasing such as *"Saya group mujhe pasand nahi hai"* had words like *"mujhe"* between the builder and the negative verb, preventing rejection capture.

### Issue 2: Inventory Omission & Sab Projects Batao Failure
- **Status:** `VERIFIED IN SOURCE` & `VERIFIED BY AUTOMATED TEST`
- **Symptom:** Customer asked *"Jo bhi projects hain, sabki details batao"*, but Aria only gave 2 or 3 projects, omitting *Future Estate* or *VVIP Pre-Launch*.
- **Root Cause Analysis:**
  - `getProjectsOverview()` in `conversation.service.ts` had an arbitrary `take: 4` limit and hardcoded fallback lists that didn't dynamically pull from the CRM database with proper preference filters (`propertyType`, `rejectedBuilders`, `rejectedProjects`).
  - Search filtering logic treated broad phrases like *"sab projects"* as a search query term, which failed text matching against project names, causing empty returns or fallback defaults.

### Issue 3: Barge-in & Playback Invalidation Failure
- **Status:** `VERIFIED IN SOURCE` & `VERIFIED BY AUTOMATED TEST`
- **Symptom:** When a customer barged in while Aria was speaking, Aria continued speaking for 2–4 seconds, or resumed playing old audio after the user stopped talking.
- **Root Cause Analysis:**
  1. In `backend/src/calls/mcube-stream.service.ts`, `bargeIn()` properly set `session.cancelPlay = true;`, but subsequent functions like `sendPlayAudio()` and speech activity detection had bugs where they reset `session.cancelPlay = false;`, un-cancelling the abort!
  2. In-flight LLM token streaming and ElevenLabs TTS requests were not tied to an `AbortController`. Even though `clearAudio` was sent over WebSocket to MCube, in-flight TTS chunks arrived moments later and were sent as new audio to MCube.
  3. MCube `playedStream` events from old audio segments were processed without checking `flushGen`, resetting audio state inappropriately.

### Issue 4: TTS Sentence Splitting on Decimals & Measurements
- **Status:** `VERIFIED IN SOURCE` & `VERIFIED BY AUTOMATED TEST`
- **Symptom:** Aria spoke *"Isme starting price saath point"* ... pause ... *"nau lakh hai"*. Or super area *"1250 sq"* ... pause ... *"ft hai"*.
- **Root Cause Analysis:**
  - `pullSpokenSentences()` in `conversation.service.ts` used a naive regex `/[.!?।\n]+/g` to find sentence endings.
  - Periods inside numbers (`60.9`, `63.99`) and abbreviations (`sq.ft`, `no.`, `approx.`) were treated as full sentence boundaries.
  - Raw numbers were passed directly to ElevenLabs TTS without Hindi pronunciation normalization, leading to awkward digit-by-digit or robotic English number pronunciations.

### Issue 5: WhatsApp Delivery Language Ambiguity
- **Status:** `VERIFIED IN SOURCE` & `VERIFIED BY AUTOMATED TEST`
- **Symptom:** Aria promised *"Main WhatsApp bhej rahi hoon"* even when Meta WhatsApp Cloud API was not configured or threw an error.
- **Root Cause Analysis:**
  - `WhatsAppService.sendDocument()` returned `success: false` on error, but the voice script didn't check the response before promising immediate delivery, failing to inform the customer that the offline sales team would follow up.

---

## 3. Architecture Verification Matrix

| Component | Audit Observation | Status |
| :--- | :--- | :--- |
| **CustomerMemoryService** | Restores preferences across calls from DB `ConversationMemory`; syncs Redis with DB on cache hit | `VERIFIED IN SOURCE` |
| **FactExtractorService** | Extracts pre-noun and post-noun rejections with filler words (`mujhe`, `bhi`, `ko`); distinguishes affirmative pivots | `VERIFIED IN SOURCE` |
| **ConversationService** | Replaced hardcoded prompt lists with dynamic CRM DB query; filters out rejected builders & projects; supports full catalog retrieval | `VERIFIED IN SOURCE` |
| **TTS Splitter & Audio Normalizer** | Decimal-aware & abbreviation-aware sentence boundary detection (`pullSpokenSentences`); Hindi speech normalization (`normalizeTextForSpeech`) | `VERIFIED IN SOURCE` |
| **McubeStreamService** | Turn-level `AbortController`; `flushGen` generation tracking; drops stale chunks; sends `clearAudio` & `clear` | `VERIFIED IN SOURCE` |
| **WhatsAppService** | Honest customer-facing disclaimers based on real Meta Cloud API dispatch status | `VERIFIED IN SOURCE` |

