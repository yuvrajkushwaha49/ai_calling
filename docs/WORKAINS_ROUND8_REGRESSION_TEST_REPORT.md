# WORKAINS REALITY — REGRESSION TEST REPORT

**Date:** 18 November 2026  
**Test Suite File:** [aria-round8-intelligence.spec.ts](file:///d:/Yuvi/Piyush%20React/ai_calling/backend/src/conversation/aria-round8-intelligence.spec.ts)  
**Total Repository Suites:** 18  
**Total Tests:** 253  
**Passing Tests:** 253  
**Failing Tests:** 0  
**Status:** `VERIFIED BY AUTOMATED TEST`

---

## 1. Test Suite Summary

The automated regression test suite was expanded in Round 8 with 42 new test scenarios directly covering the requirements outlined in Section 11 of the technical directive. All 253 tests across 18 test suites passed with 0 failures.

```
Test Suites: 18 passed, 18 total
Tests:       253 passed, 253 total
Snapshots:   0 total
Time:        16.996 s
```

---

## 2. Round 8 Specific Test Scenarios (42 Scenarios)

| # | Scenario Description | Tested Module | Result |
| :---: | :--- | :--- | :---: |
| **1** | Fresh call answered with no property facts has a baseline score of 0 (Never auto-qualifies) | `interest-score.ts` | `PASS` |
| **2** | Capturing BHK preference awards exactly 20 points | `interest-score.ts` | `PASS` |
| **3** | Capturing Budget preference awards exactly 20 points | `interest-score.ts` | `PASS` |
| **4** | Capturing Location preference awards exactly 15 points | `interest-score.ts` | `PASS` |
| **5** | Capturing Timeline / Possession preference awards exactly 15 points | `interest-score.ts` | `PASS` |
| **6** | Capturing Purpose (end-use / investment) awards exactly 10 points | `interest-score.ts` | `PASS` |
| **7** | Agreeing to a site visit awards exactly 20 points | `interest-score.ts` | `PASS` |
| **8** | Lead meeting threshold >= 60 points qualifies transparently | `interest-score.ts` | `PASS` |
| **9** | Customer stating "not interested" triggers explicit disqualification (score <= 10) | `interest-score.ts` | `PASS` |
| **10** | Preference sources and timestamps are tracked for every attribute | `interest-score.ts` | `PASS` |
| **11** | "Achha" receives natural acknowledgement without resetting discovery | `call-scripts.ts` | `PASS` |
| **12** | "Haan batao" / "Uske baare mein aur batao" deepens locked project facts | `call-scripts.ts` | `PASS` |
| **13** | "Price kya hai?" provides immediate factual pricing for locked project | `call-scripts.ts` | `PASS` |
| **14** | "Location kahan hai?" delivers exact location and connectivity for discussed project | `call-scripts.ts` | `PASS` |
| **15** | "Nahi, doosra option batao" releases context lock and introduces alternatives | `call-scripts.ts` | `PASS` |
| **16** | "Abhi budget clear nahi hai" provides gentle guidance without pressing | `call-scripts.ts` | `PASS` |
| **17** | "WhatsApp kar do" confirms sending verified details to customer phone | `call-scripts.ts` | `PASS` |
| **18** | One-question-at-a-time enforcement: trims secondary questions | `question-validator.service.ts` | `PASS` |
| **19** | No repeated discovery: blocks re-asking BHK when already answered | `question-validator.service.ts` | `PASS` |
| **20** | No repeated discovery: blocks re-asking budget when already captured | `question-validator.service.ts` | `PASS` |
| **21** | Generic acknowledgement ("theek hai") never books a site visit (visitState: REQUESTED) | `appointments.service.ts` | `PASS` |
| **22** | Generic acknowledgement ("haan ji") never auto-books | `appointments.service.ts` | `PASS` |
| **23** | Incomplete date or time marks visit state as PENDING_CONFIRMATION | `appointments.service.ts` | `PASS` |
| **24** | Valid date, time, and project confirmation books appointment (visitState: CONFIRMED) | `appointments.service.ts` | `PASS` |
| **25** | Rescheduling existing visit updates appointment without duplication (visitState: RESCHEDULED) | `appointments.service.ts` | `PASS` |
| **26** | Explicit visit cancellation marks state as CANCELLED | `appointments.service.ts` | `PASS` |
| **27** | Relative callback parsing: "kal call karna" resolves to tomorrow with IST offset | `meeting-time.ts` | `PASS` |
| **28** | Relative callback parsing: "kal shaam 5 baje" resolves tomorrow 05:00 PM in IST | `meeting-time.ts` | `PASS` |
| **29** | Relative callback parsing: "parso call karna" resolves day after tomorrow | `meeting-time.ts` | `PASS` |
| **30** | DNC / opt-out detection respects user request and sets doNotCall flag | `call-scripts.ts` | `PASS` |
| **31** | Outbound WhatsApp brochure includes full builder attribution | `whatsapp.service.ts` | `PASS` |
| **32** | WhatsApp dispatch is blocked if customer opted out or lacks consent | `whatsapp.service.ts` | `PASS` |
| **33** | Webhook status update tracks READ lifecycle state | `whatsapp.service.ts` | `PASS` |
| **34** | Duplicate webhook delivery is handled idempotently without duplicate side effects | `whatsapp.service.ts` | `PASS` |
| **35** | Indian 2-comma numbering "1,50,000 sq.ft." normalizes without hanging comma | `phone-audio.ts` | `PASS` |
| **36** | Square yard / Gaj measurements normalize to spoken words | `phone-audio.ts` | `PASS` |
| **37** | RERA registration number normalizes to spoken spaces for clean TTS | `phone-audio.ts` | `PASS` |
| **38** | Currency with decimals "₹60.90 Lakh" normalizes with natural Hindi grouping | `phone-audio.ts` | `PASS` |
| **39** | Integer Lakhs "₹80 Lakh" normalizes cleanly without concatenation | `phone-audio.ts` | `PASS` |
| **40** | WebSocket reconnect with matching callId preserves prior conversation state and facts | `mcube-stream.service.ts` | `PASS` |
| **41** | False barge-in rejection: single ambient spike (bargeHits < 2) does not abort playback | `mcube-stream.service.ts` | `PASS` |
| **42** | Workains Reality Channel Partner Identity: AI never claims to be developer or builder | `call-scripts.ts` | `PASS` |
