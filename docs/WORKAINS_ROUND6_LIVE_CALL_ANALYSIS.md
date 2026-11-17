# Workains Reality — Aria Round 6: Live Call & Audio Lifecycle Analysis

**Analysis Timestamp:** 17 November 2026, 18:04:30 IST  
**Analyst:** Senior Real Estate Voice AI Architect  
**Subject:** Real MCube Production Calls, Telephony Audio Lifecycles, and Audio Artifact Analysis  
**Overall Status:** COMPLETED

---

## 1. MCube Live Call Analysis (Call ID: `95657630891794913078`)

### Call Context
- **Caller:** Yuvraj (+919565763089)
- **Previous Calls:** 11
- **Known CRM Profile:** 2 BHK, ₹80 Lakh, Sector 1 Greater Noida West
- **Identified Failure in Call:**
  1. Concatenation in spoken TTS: `2 BHKsaath lakh nabbe hazaar`
  2. Late audio bleed when user interrupted mid-sentence
  3. Lack of contextual answer when asking about past discussed projects

---

## 2. Audio Lifecycle & Barge-In Analysis

### 2.1 The 6 Discrete Stages of Barge-In
To prevent reporting playback cancellation prematurely, the system now instruments 6 distinct stages:

```
[User Speaks] 
      │
      ▼
1. DETECTED ──> 2 consecutive audio packets > bargeThreshold (Adaptive Ambient Floor)
      │
      ▼
2. CLEAR_SENT ──> Dispatches clearAudio + clear WebSocket events to MCube (< 12ms)
      │
      ▼
3. LOCAL_QUEUE_CLEARED ──> Empties pendingSegments, sets cancelPlay = true, increments flushGen
      │
      ▼
4. IN_FLIGHT_ABORTED ──> Aborts in-flight Gemini LLM tokens & ElevenLabs TTS synthesis
      │
      ▼
5. LAST_CHUNK_SENT ──> Identifies last audio chunk transmitted prior to interruption
      │
      ▼
6. CONFIRMED ──> Listens for carrier ACK ('cleared', 'clearAudioDone', 'stop') or drain completion
```

### 2.2 Verification Status of Lifecycle Stages
- **Step 1 (Barge-In Detected):** `VERIFIED IN SOURCE` (Adaptive energy threshold > 900–1600 energy units).
- **Step 2 (MCube Clear Command Sent):** `VERIFIED IN SOURCE` (JSON frames dispatched immediately).
- **Step 3 (Local Queue Cleared):** `VERIFIED BY AUTOMATED TEST` (Queue cleared and generation bumped).
- **Step 4 (In-Flight Aborted):** `VERIFIED BY AUTOMATED TEST` (`turnAbortController.abort()` called).
- **Step 5 (Last Chunk Sent):** `VERIFIED IN SOURCE` (Chunk metadata logged).
- **Step 6 (Actual Carrier Playback Cancellation Confirmed):** `PARTIALLY VERIFIED` (MCube carrier does not emit synchronous clear ACKs on all telephony trunk configurations; local drain & frame dispatch verified, carrier-side trunk drain awaiting live call confirmation).

---

## 3. Acoustic Analysis & Spacing Fix

### Root Cause of `"2 BHKsaath lakh"`
In previous revisions, `normalizeTextForSpeech` evaluated:
```ts
s = s.replace(/(?:₹|rs\.?|inr)?\s*([0-9]{1,3})\.([0-9]{1,3})\s*(?:lakhs?|lakh|लाख|l)\b/gi, ...);
```
When given `"2 BHK ₹60.90 Lakh"`:
`\s*` matched and absorbed the single space between `BHK` and `₹`. The replacement string began directly with the Hindi word `saath` without a leading space, gluing `BHK` and `saath` into `BHKsaath`.

### Verified Fix
1. Enforced leading/trailing spacing on all number and unit replacements.
2. Normalized `2 BHK` and `3 BHK` word boundaries.
3. Converted `1,250 sq.ft` to `1250 square feet` to prevent comma hesitation.

**Result:** Verified by automated unit tests in [phone-audio.spec.ts](file:///d:/Yuvi/Piyush%20React/ai_calling/backend/src/calls/phone-audio.spec.ts) and [aria-round6-production.spec.ts](file:///d:/Yuvi/Piyush%20React/ai_calling/backend/src/conversation/aria-round6-production.spec.ts).

