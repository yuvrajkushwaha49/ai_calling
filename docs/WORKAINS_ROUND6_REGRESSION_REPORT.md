# Workains Reality — Aria Round 6: Regression Test Report

**Test Run Timestamp:** 17 November 2026, 18:04:00 IST  
**Test Framework:** Jest / NestJS Testing Module  
**Total Test Suites:** 16 Passed / 16 Total (100%)  
**Total Tests:** 181 Passed / 181 Total (100%)  
**Regression Status:** PASS (Zero Failures)

---

## 1. 20 Mandatory Round 6 Scenarios Matrix

All 20 required scenarios are automated and verified in [aria-round6-production.spec.ts](file:///d:/Yuvi/Piyush%20React/ai_calling/backend/src/conversation/aria-round6-production.spec.ts).

| Scenario # | Description | Asserted Condition | Status |
| :---: | :--- | :--- | :--- |
| **1** | Spacing bug fix on `2 BHK₹60.90 Lakh` | Output is `"2 BHK saath lakh nabbe hazaar rupaye"`; no `"BHKsaath"` concatenation | `VERIFIED BY AUTOMATED TEST` |
| **2** | Decimal currency normalization `₹63.99 Lakh` | Normalizes to `"tirasath lakh ninyanve hazaar rupaye"` without decimal split | `VERIFIED BY AUTOMATED TEST` |
| **3** | Stretch currency normalization `₹86.32 Lakh` | Normalizes to `"chhiyaasi lakh battis hazaar rupaye"` | `VERIFIED BY AUTOMATED TEST` |
| **4** | Rate per sq.ft normalization `₹8,888 per sq.ft` | Normalizes to `"aath hazaar aath sau athasi rupaye per square foot"` | `VERIFIED BY AUTOMATED TEST` |
| **5** | Unit measurement `720 sq.ft` | Normalizes to `"720 square feet"` without mid-word splitting | `VERIFIED BY AUTOMATED TEST` |
| **6** | Area with comma `1,250 sq.ft` | Normalizes to `"1250 square feet"` cleanly | `VERIFIED BY AUTOMATED TEST` |
| **7** | Configuration formatting `2 BHK` and `3 BHK` | Preserves clean word boundaries for `"2 BHK"` and `"3 BHK"` | `VERIFIED BY AUTOMATED TEST` |
| **8** | Returning customer memory hydration | Customer profile hydrates `lastDiscussedProject` (`Palace Heights by Rudra`) across calls | `VERIFIED BY AUTOMATED TEST` |
| **9** | Recall past project query | *"Maine pichhli baar kis project ke baare mein baat ki thi?"* answers with Palace Heights by Rudra | `VERIFIED BY AUTOMATED TEST` |
| **10** | Builder rejection persistence | *"Saya mujhe nahi chahiye"* captures rejection and strictly excludes all Saya projects | `VERIFIED BY AUTOMATED TEST` |
| **11** | Alternatives inquiry | *"Uske alawa kya options hain?"* provides alternative non-rejected projects (Palace Heights, NCR Monarch) | `VERIFIED BY AUTOMATED TEST` |
| **12** | sab projects query retrieves all eligible records | *"Sab projects batao"* returns all active inventory without artificial 3-project cap | `VERIFIED BY AUTOMATED TEST` |
| **13** | Contextual project resolution | *"NCR ke baare mein batao"* resolves to NCR Monarch without confusion | `VERIFIED BY AUTOMATED TEST` |
| **14** | Short acknowledgement *"Okay"* | Natural continuation without restarting pitch or asking known BHK | `VERIFIED BY AUTOMATED TEST` |
| **15** | Missing feature inquiry | *"Kya nahi hai?"* clarifies polite scope without conversational derailment | `VERIFIED BY AUTOMATED TEST` |
| **16** | Callback request | *"Abhi busy hoon, baad mein call karna"* confirms callback politely without unsolicited goodbye | `VERIFIED BY AUTOMATED TEST` |
| **17** | Document dispatch request | *"WhatsApp par bhej do"* notes document dispatch without claiming premature delivery | `VERIFIED BY AUTOMATED TEST` |
| **18** | Barge-in lifecycle state transitions | Invalidates queue, increments flush generation, aborts in-flight generation | `VERIFIED BY AUTOMATED TEST` |
| **19** | Stale chunk drop logic | Chunk with older generation or active cancellation is discarded before send | `VERIFIED BY AUTOMATED TEST` |
| **20** | Meta WhatsApp webhook status transition | Webhook accurately transitions message from `SENT` to `DELIVERED` | `VERIFIED BY AUTOMATED TEST` |

---

## 2. Complete Test Suite Execution Output

```text
PASS src/conversation/aria-intelligence.spec.ts
PASS src/app.controller.spec.ts
PASS src/memory/customer-memory.service.spec.ts
PASS src/conversation/aria-round2-regression.spec.ts
PASS src/conversation/aria-round3-regression.spec.ts
PASS src/conversation/workains-identity.spec.ts
PASS src/conversation/aria-round5-intelligence.spec.ts
PASS src/calls/call-scripts.spec.ts
PASS src/memory/question-validator.service.spec.ts
PASS src/calls/phone-audio.spec.ts
PASS src/memory/phone-utils.spec.ts
PASS src/conversation/sales-agent-prompt.spec.ts
PASS src/appointments/meeting-time.spec.ts
PASS src/memory/fact-extractor.service.spec.ts
PASS src/conversation/aria-round6-production.spec.ts
PASS src/conversation/aria-critical-fixes.spec.ts

Test Suites: 16 passed, 16 total
Tests:       181 passed, 181 total
Snapshots:   0 total
Time:        6.206 s
```

