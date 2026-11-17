# Aria Round 2 Live Call Regression Audit

## Executive Summary

Following the Round 1 deployment (12/12 critical fix tests passing, 91 total tests passing), real-world MCube call logs revealed 7 concrete behavioral and runtime regressions during live calls. This audit analyzes the root causes in the codebase and specifies the remediation architecture.

---

## 1. Issue Audits & Root Cause Analysis

### Issue 1: Strict Budget Matching Failure
- **Observed Behavior:** Customer explicitly specified a budget of ₹80 Lakh. The AI recommended Future Estate (₹86 Lakh) and VVIP Pre-Launch (₹91 Lakh) without stating that they exceeded the customer's budget, without disclosing the price difference, and without asking permission to present stretch-budget options.
- **Root Cause:** In `ConversationService.getProjectsOverview()`, projects were listed as an unsegregated flat list. The prompt lacked explicit budget-bucketing rules, allowing the LLM to pick any residential project regardless of the caller's stated ceiling.
- **Verification Status:** `VERIFIED IN SOURCE` & `VERIFIED BY AUTOMATED TEST` (Test 1.1 & 1.2 in `aria-round2-regression.spec.ts`).

---

### Issue 2: Failure to Answer Floor Plan & Unit Size Questions
- **Observed Behavior:**
  - Caller asked: *"मुझे sizes बता दीजिए एक एक।"* ➔ AI did not provide unit sizes.
  - Caller asked: *"Floor plan बता दो मुझे इसका।"* ➔ AI deflected and pitched a weekend site visit instead of answering.
- **Root Cause:**
  1. The regex `asksDetail` in `ConversationService.reply()` did not capture `size`, `sizes`, `area`, `sqft`, `layout`, `floor plan`, or `map`.
  2. The project prompt template did not embed verified configuration sizes (sq.ft) per unit.
  3. System prompts ended with sales qualification instructions, causing the LLM to skip technical queries in favor of scheduling.
- **Verification Status:** `VERIFIED IN SOURCE` & `VERIFIED BY AUTOMATED TEST` (Test 2.1 & 2.2 in `aria-round2-regression.spec.ts`).

---

### Issue 3: Project Information Discrepancies & Hallucination Risk
- **Observed Behavior:** Caller enquired about VVIP Pre-Launch. The AI made specific claims about 5 acres, 5 towers, starting ₹91 Lakh, and attached balconies / modular kitchen.
- **Audit Findings:**
  - The CRM project seed (`backend/scripts/reset-and-seed-projects.js`) confirms VVIP Pre-Launch is indeed 5 acres, 5 towers (G+30 floors, 750 units, 4 lifts/floor), 60,000 sq.ft clubhouse, and 2 BHK starting at 1250 sq.ft @ ₹7,250 = ₹90.625 Lakh (~₹91 Lakh).
  - However, claims regarding specific kitchen fittings or balcony fixtures were not verified in the CRM knowledge base and represented unanchored LLM embellishments.
- **Remediation:** Injected canonical project data and added a strict rule: only verified source facts may be stated; missing specific details must trigger an offer for team follow-up rather than guessing.
- **Verification Status:** `VERIFIED IN SOURCE` & `VERIFIED BY AUTOMATED TEST` (Test 3.1 & 3.2 in `aria-round2-regression.spec.ts`).

---

### Issue 4: WhatsApp Promise Without Delivery Infrastructure
- **Observed Behavior:** AI repeatedly promised: *"Main WhatsApp par layout aur details share kar rahi hoon"*, but no delivery gateway was called, no customer phone number was verified, and no message delivery status was tracked.
- **Root Cause:** No WhatsApp module existed in NestJS. The AI made conversational promises without an underlying API contract.
- **Remediation:** Created `WhatsAppModule` and `WhatsAppService` supporting statuses `QUEUED`, `SENT`, `DELIVERED`, `FAILED`, and `UNAVAILABLE`. Standardized the conversational disclaimer: *"Main team ko note karwa deti hoon, wo details aur layout verify karke aapke WhatsApp number par share kar denge."*
- **Verification Status:** `VERIFIED IN SOURCE` & `VERIFIED BY AUTOMATED TEST` (Test 4.1 & 4.2 in `aria-round2-regression.spec.ts`).

---

### Issue 5: Canonical Response / Logging Mismatch (09:57:18 Race Condition)
- **Observed Behavior:**
  - `[MCube] 🤖 AI Speaking:` Contained VVIP project details.
  - `[ConversationService] Conversation Reply:` Contained an unrelated scripted question (*"Aap 2 BHK flat dekh rahe hain ya 3 BHK?"*).
  - `[MCube] 🤖 Turn log:` Contained VVIP details.
- **Root Cause:** In `ConversationService.reply()`, when `options.stream` was enabled, the LLM streamed tokens directly to `onSentence()` (which synthesized and played VVIP audio). However, at line 1185, `isSameTalk(replyText, previousAgent)` was evaluated after streaming. Because it evaluated true, `replyText` was overwritten with `fallback.text`. `ConversationService` logged and returned `fallback.text`, while the caller heard the streamed audio!
- **Remediation:** Added `!streamed` check: `if (!streamed && previousAgent && isSameTalk(replyText, previousAgent))`. When audio has already been streamed, `replyText` is locked to the emitted text.
- **Verification Status:** `VERIFIED IN SOURCE` & `VERIFIED BY AUTOMATED TEST` (Test 5.1 in `aria-round2-regression.spec.ts`).

---

### Issue 6: 10–12 Second Turn Latency
- **Observed Behavior:** Voice turns suffered 10–12 second delays before caller heard audio.
- **Root Causes:**
  1. `LlmService.chatStream()` contained non-existent model strings: `gemini-3.5-flash` and `gemini-3.6-flash`. Each non-existent candidate timed out or failed before falling back.
  2. Candidate resolution put fallback models before the caller's requested model.
  3. `ConversationService.getProjectsOverview()` and `matchProjectFromSpeech()` executed un-cached `prisma.project.findMany` queries on every single spoken turn.
- **Remediation:** Removed non-existent models, placed `model` first in candidates, and introduced an in-memory 5-minute cache (`cachedProjects`) for project lookups.
- **Verification Status:** `VERIFIED IN SOURCE` & `VERIFIED BY AUTOMATED TEST` (Test 6.1 in `aria-round2-regression.spec.ts`).

---

### Issue 7: Unnatural Isolated "Hello?" Opening
- **Observed Behavior:** Live call connected with an isolated, cold *"Hello?"*, missing company branding, caller recognition, and context continuation.
- **Remediation:** Replaced isolated opener in `McubeStreamService` with:
  - **Returning Caller:** *"Namaste [Name] ji! Main Aria, Saya Group se bol rahi hoon. Pichhli baar hamari baat [known requirement] ko lekar hui thi. Kya aaj usi ko continue karein?"*
  - **New Caller:** *"Namaste ji! Main Aria, Saya Group se bol rahi hoon. Aapki property requirement ke baare mein baat kar sakti hoon?"*
  - Opener is immediately recorded in `session.transcript` and `CustomerMemoryService` turn history, preventing duplicate greetings on subsequent turns.
- **Verification Status:** `VERIFIED IN SOURCE` & `VERIFIED BY AUTOMATED TEST` (Test 7.1 & 7.2 in `aria-round2-regression.spec.ts`).

---

## 2. Audit Verification Summary Matrix

| Issue ID | Area | Root Cause Verified | Source Fixed | Automated Tests | Live Call Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ISSUE-1** | Strict Budget Matching | Flat catalog without budget bucketing | `conversation.service.ts` | 12/12 Passed | `PENDING LIVE SESSION` |
| **ISSUE-2** | Floor Plans & Sizes | Missing regex & configuration data | `conversation.service.ts` | 12/12 Passed | `PENDING LIVE SESSION` |
| **ISSUE-3** | Verified Project Info | Unanchored LLM embellishments | CRM catalog synced | 12/12 Passed | `PENDING LIVE SESSION` |
| **ISSUE-4** | WhatsApp Delivery | Missing service & unverified claims | `whatsapp.service.ts` | 12/12 Passed | `PENDING LIVE SESSION` |
| **ISSUE-5** | Canonical Log Mismatch | `isSameTalk` overwriting streamed reply | `conversation.service.ts` | 12/12 Passed | `PENDING LIVE SESSION` |
| **ISSUE-6** | Gemini Latency | Invalid model names & repeated DB hits | `llm.service.ts` & caching | 12/12 Passed | `PENDING LIVE SESSION` |
| **ISSUE-7** | Natural Opening | Static "Hello?" string | `mcube-stream.service.ts` | 12/12 Passed | `PENDING LIVE SESSION` |

