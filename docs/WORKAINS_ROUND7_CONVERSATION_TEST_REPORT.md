# WORKAINS REALITY — ARIA ROUND 7 CONVERSATION TEST REPORT
**Project:** Workains Reality — AI Calling CRM  
**Agent:** Aria  
**Round:** 7  
**Test Suite:** `backend/src/conversation/aria-round7-continuity.spec.ts`  
**Execution Date:** November 17, 2026  
**Total Tests:** 30 Scenarios  
**Results:** 30 Passed / 0 Failed  

---

## 1. CONVERSATION TEST SUITE MATRIX (30 MANDATORY SCENARIOS)

| # | Scenario Description | Customer Input / Context | Aria Spoken Output / System Action | Status |
|---|---|---|---|---|
| 1 | Returning customer asks about last discussed project | *"Pichhli baar humne kis project ke baare mein baat ki thi?"* | Recalls *"Palace Heights by Rudra"* without confusing developers. | `VERIFIED BY AUTOMATED TEST` |
| 2 | Customer says *"Nahi usi ke baare mein continue karte hain"* | *"Nahi usi ke baare mein continue karte hain"* | Locks to Palace Heights; continues unit sizes and pricing without switching. | `VERIFIED BY AUTOMATED TEST` |
| 3 | Aria continues exactly one project | Context locked to Palace Heights | Generates overview containing solely Palace Heights; zero other projects leaked. | `VERIFIED BY AUTOMATED TEST` |
| 4 | Project context lock prevents accidental switching | Follow-up *"Aage batao"* | Retains locked project context on Palace Heights; lock remains active. | `VERIFIED BY AUTOMATED TEST` |
| 5 | Explicit project change releases the lock | *"Future Estate ke baare mein batao"* | Releases Palace Heights lock; establishes new lock on Future Estate. | `VERIFIED BY AUTOMATED TEST` |
| 6 | *"Uske alawa options"* returns eligible alternatives | *"Uske alawa aur kya options hain?"* | Releases lock; provides NCR Monarch and Palace Heights alternatives. | `VERIFIED BY AUTOMATED TEST` |
| 7 | Rejected Saya Group remains excluded across calls | Rejection of Saya Group in memory | Excludes Saya Pre-Launch, Saya South X, and Saya Piazza from overview. | `VERIFIED BY AUTOMATED TEST` |
| 8 | Customer explicitly reverses a builder rejection | *"Saya Group ke projects bhi dikhao, mujhe chalega"* | Re-admits Saya Group into preferred builders list. | `VERIFIED BY AUTOMATED TEST` |
| 9 | Unknown project reference triggers clarification | *"Kisi project ke baare mein batao"* | Asks a polite clarification question rather than guessing. | `VERIFIED BY AUTOMATED TEST` |
| 10 | *"Pehle wala project"* resolves from memory | *"Pehle wala project continue karo"* | Resolves Palace Heights from persistent memory and continues details. | `VERIFIED BY AUTOMATED TEST` |
| 11 | *"Kitne ka hai?"* resolves current project's price | *"Kitne ka hai?"* (Palace Heights locked) | Spoken: *"Palace Heights mein 1 BHK ₹60.90 Lakh se start hota hai..."* | `VERIFIED BY AUTOMATED TEST` |
| 12 | *"Kitna bada hai?"* resolves current configuration's size | *"Kitna bada hai?"* (2 BHK Palace Heights) | Spoken: *"Palace Heights mein 2 BHK ke size 1015 sq.ft aur 1088 sq.ft mein aate hain."* | `VERIFIED BY AUTOMATED TEST` |
| 13 | No unsupported clubhouse claims | Locked Palace Heights overview | Spoken: 30,000 sq.ft clubhouse (DB verified). Never recites unbacked 1,50,000 sq.ft club. | `VERIFIED BY AUTOMATED TEST` |
| 14 | No unsupported amenities fabricated | Specific unlisted fittings query | Deferral: *"Is specific detail ki verified information main team se confirm karke WhatsApp par share karwa doongi."* | `VERIFIED BY AUTOMATED TEST` |
| 15 | Correct builder attribution | Multi-project list | Palace Heights -> Rudra Buildwell, NCR Monarch -> NCR Group, Future Estate -> Future World. | `VERIFIED BY AUTOMATED TEST` |
| 16 | Missing RERA information is not invented | Query on VVIP (RERA null in DB) | Exposes verified RERA when present (`UPRERAPRJ11124`); never fabricates placeholder RERA. | `VERIFIED BY AUTOMATED TEST` |
| 17 | Incorrect or stale inventory facts are not spoken | Price verification query | Palace Heights: ₹60.90L, NCR Monarch: ₹63.99L, Future Estate: ₹86.32L verified. | `VERIFIED BY AUTOMATED TEST` |
| 18 | ₹60.90 lakh normalization | `"₹60.90 lakh"` input to TTS | Normalizes to `"saath lakh nabbe hazaar rupaye"` without concatenation. | `VERIFIED BY AUTOMATED TEST` |
| 19 | ₹63.99 lakh normalization | `"₹63.99 lakh"` input to TTS | Normalizes to `"tirasath lakh ninyanve hazaar rupaye"`. | `VERIFIED BY AUTOMATED TEST` |
| 20 | ₹86.32 lakh normalization | `"₹86.32 lakh"` input to TTS | Normalizes to `"chhiyaasi lakh battis hazaar rupaye"`. | `VERIFIED BY AUTOMATED TEST` |
| 21 | 1,50,000 sq.ft. pronunciation | `"1,50,000 sq.ft."` input to TTS | Normalizes to `"150000 square feet."` with zero hanging commas or unnatural pauses. | `VERIFIED BY AUTOMATED TEST` |
| 22 | 2 BHK word boundary | `"2 BHK flat ₹60.90 lakh"` | Normalizes to `"2 BHK flat saath lakh nabbe hazaar rupaye"` (no `"BHKsaath"`). | `VERIFIED BY AUTOMATED TEST` |
| 23 | Background noise does not trigger inappropriate barge-in | Ambient noise packet burst | Requires 2 consecutive energy spikes above threshold; single glitch frame ignored. | `VERIFIED BY AUTOMATED TEST` |
| 24 | Stale chunks are discarded after interruption | User interrupts, increments `flushGen` | Chunks from prior generation `gen < session.flushGen` immediately dropped. | `VERIFIED BY AUTOMATED TEST` |
| 25 | WhatsApp dispatch does not falsely claim delivery | Webhook status callbacks | Dispatches report `SENT`, webhooks report `DELIVERED` and `READ` distinctly. | `VERIFIED BY AUTOMATED TEST` |
| 26 | Production version identifier appears in call metadata | Telemetry module call | Exposes `version: 1.7.0`, `commitSha: e5399cc`, `deploymentId`, and `processPid`. | `VERIFIED BY AUTOMATED TEST` |
| 27 | Customer callback intent is preserved | *"Baad mein call karna, abhi main busy hoon"* | Preserves `CALLBACK_REQUESTED` outcome; does not mark as refusal. | `VERIFIED BY AUTOMATED TEST` |
| 28 | Memory is not corrupted across multiple calls | Multiple updates across call sessions | Preserves confirmed facts and project lock states cleanly in cache/store. | `VERIFIED BY AUTOMATED TEST` |
| 29 | Short acknowledgements continue the correct topic | User says *"Haan"* after project discussion | Continues layout/pricing discussion on the current project without resetting. | `VERIFIED BY AUTOMATED TEST` |
| 30 | Historical call transcripts remain unchanged | Past call record lookup | Historical call transcripts are read-only and immutable. | `VERIFIED BY AUTOMATED TEST` |

---

## 2. TEST EXECUTION SUMMARY
- **Test File:** [aria-round7-continuity.spec.ts](file:///d:/Yuvi/Piyush%20React/ai_calling/backend/src/conversation/aria-round7-continuity.spec.ts)
- **Suite Result:** 1 Suite Passed, 30 Tests Passed, 0 Failures.
- **Execution Duration:** 5.259 seconds.
