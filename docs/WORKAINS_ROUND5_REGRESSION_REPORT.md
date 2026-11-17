# Workains Reality — Aria Round 5: Regression Test Report

**Test Run Date:** 17 November 2026  
**Test Framework:** Jest / NestJS Testing Module  
**Total Test Suites:** 15 Passed / 15 Total (100%)  
**Total Tests:** 154 Passed / 154 Total (100%)  
**Overall Regression Status:** PASS (Zero Failures)

---

## 1. 20 Mandatory Round 5 Scenarios Matrix

All 20 required scenarios from Section 10 are automated and verified in [aria-round5-intelligence.spec.ts](file:///d:/Yuvi/Piyush%20React/ai_calling/backend/src/conversation/aria-round5-intelligence.spec.ts).

| Scenario # | Description | Test Condition / Assertion | Status |
| :---: | :--- | :--- | :--- |
| **1** | Customer rejects Saya in earlier call | Utterance *"Saya group mujhe pasand nahi hai"* extracts `rejectedBuilders: ['Saya Group']` | `VERIFIED BY AUTOMATED TEST` |
| **2** | Same customer calls again (cross-call persistence) | `lookupCustomer('+919565763089')` retrieves `rejectedBuilders: ['Saya Group']` from DB `ConversationMemory` | `VERIFIED BY AUTOMATED TEST` |
| **3** | Saya is not recommended again | `getProjectsOverview({ rejectedBuilders: ['Saya Group'] })` strictly excludes all Saya projects | `VERIFIED BY AUTOMATED TEST` |
| **4** | Customer explicitly changes their preference | Affirmative interest in Saya clears it from `rejectedBuilders` and moves to `preferredBuilders` | `VERIFIED BY AUTOMATED TEST` |
| **5** | Rejected project is filtered | `getProjectsOverview({ rejectedProjects: ['Future Estate'] })` excludes Future Estate | `VERIFIED BY AUTOMATED TEST` |
| **6** | All eligible projects are retrieved (*"Sab projects batao"*) | Retrieval returns all matching DB inventory without arbitrary limits | `VERIFIED BY AUTOMATED TEST` |
| **7** | Future Estate is not accidentally omitted | Verified present in residential Greater Noida West inventory | `VERIFIED BY AUTOMATED TEST` |
| **8** | VVIP inventory is not accidentally omitted | Verified present in Raj Nagar Extension inventory | `VERIFIED BY AUTOMATED TEST` |
| **9** | Developer attribution remains accurate | Output explicitly specifies `[Developer: <BuilderName>]` for each project | `VERIFIED BY AUTOMATED TEST` |
| **10** | Customer says "NCR" after discussing NCR Monarch | `detectIntent` & `buildFollowUpReply` resolves context to *NCR Monarch* | `VERIFIED BY AUTOMATED TEST` |
| **11** | Customer says "Okay" after receiving an answer | Natural brief acknowledgement without restarting pitch or asking known facts | `VERIFIED BY AUTOMATED TEST` |
| **12** | Customer asks *"Kya nahi hai?"* | Clarifies specific features, amenities, or missing details politely | `VERIFIED BY AUTOMATED TEST` |
| **13** | Barge-in invalidates pending audio | Calling `bargeIn()` sets `cancelPlay = true`, increments `flushGen`, clears queue | `VERIFIED BY AUTOMATED TEST` |
| **14** | Old audio cannot play after cancellation | `sendPlayAudio` strictly drops chunks with stale `flushGen` or active `cancelPlay` | `VERIFIED BY AUTOMATED TEST` |
| **15** | `₹63.99 Lakh` stays together in TTS chunking | `pullSpokenSentences` does not split on decimal point in currency numbers | `VERIFIED BY AUTOMATED TEST` |
| **16** | `₹60.9 Lakh` stays together in TTS chunking | `pullSpokenSentences` preserves number; `normalizeTextForSpeech` normalizes to Hindi words | `VERIFIED BY AUTOMATED TEST` |
| **17** | `sq.ft` is not separated from its number | `pullSpokenSentences` ignores `sq.ft` abbreviation period; normalizes to `"square feet"` | `VERIFIED BY AUTOMATED TEST` |
| **18** | Unsupported amenities are not invented | Projects only report verified amenities from CRM DB record | `VERIFIED BY AUTOMATED TEST` |
| **19** | WhatsApp failure is reported accurately | API failure generates transparent customer disclaimer | `VERIFIED BY AUTOMATED TEST` |
| **20** | Customer memory correct after Redis invalidation | On cache miss / Redis reboot, customer preferences reload accurately from Postgres DB | `VERIFIED BY AUTOMATED TEST` |

---

## 2. Complete Test Suite Execution Summary

```text
PASS src/appointments/meeting-time.spec.ts
PASS src/calls/phone-audio.spec.ts
PASS src/memory/phone-utils.spec.ts
PASS src/memory/fact-extractor.service.spec.ts
PASS src/calls/call-scripts.spec.ts
PASS src/conversation/workains-identity.spec.ts
PASS src/conversation/aria-round2-regression.spec.ts
PASS src/conversation/sales-agent-prompt.spec.ts
PASS src/conversation/aria-round5-intelligence.spec.ts
PASS src/conversation/aria-round3-regression.spec.ts
PASS src/conversation/aria-critical-fixes.spec.ts
PASS src/conversation/aria-intelligence.spec.ts
PASS src/app.controller.spec.ts
PASS src/memory/customer-memory.service.spec.ts
PASS src/memory/question-validator.service.spec.ts

Test Suites: 15 passed, 15 total
Tests:       154 passed, 154 total
Snapshots:   0 total
Time:        9.71 s
```

