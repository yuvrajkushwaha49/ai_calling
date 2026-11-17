# Aria Round 3 — Live Call Root Cause Analysis & Investigation Report

## Executive Summary

On 17 November 2026, approximately 10:18 AM–10:20 AM, live MCube call `95657630891794910700` exposed critical runtime regressions:
1. At **10:19:30**, Gemini generated a factual stretch-budget disclosure and permission question (*"Isme 2 BHK ₹91 Lakh se start hota hai — kyunki yeh aapke ₹80 Lakh budget se ₹11 Lakh upar hai, kya main iski aur details aapko bataun?"*). `QuestionValidatorService` falsely flagged this as a repeated budget question, destroyed the answer, and replaced it with a generic site-visit pitch (*"Ji, aapka budget 80 Lakh humne note kar liya hai. Kya aap is weekend project ka sample flat dekhne ke liye site visit plan karna chahenge?"*).
2. At **10:19:57**, after customer asked for 2 BHK details, the same destruction occurred.
3. Spoken sentences and final transcripts suffered race conditions during streaming and barge-in.
4. Turn 6 experienced high latency (5,899ms total, LLM first token 3,872ms).
5. TTS latency telemetry falsely logged `TTS_first_audio=0ms` due to asynchronous execution order.
6. The AI repeated the long returning-customer welcome pitch after the caller interrupted with "Hello".

---

## 1. Root Cause Breakdown by Area

### P0-1: Anti-Repetition Validator Destroying Factual Answers
- **Exact File:** `backend/src/memory/question-validator.service.ts`
- **Defective Logic:**
  ```typescript
  // Old budget detector:
  budget: /(?:budget|kitna\s*budget|approximate\s*budget|बजट|कितना\s*बजट)/i
  ```
  The regex matched ANY sentence containing the word `budget` or `बजट`.
- **Failure Sequence:**
  1. Gemini output contained: *"yeh aapke ₹80 Lakh budget se ₹11 Lakh upar hai, kya main iski aur details aapko bataun?"*
  2. Because the sentence contained `budget`, `questionDetectors.budget.test(text)` evaluated to `true`.
  3. `customer.budgetLabel` was already stored in memory (`80 Lakh`).
  4. The validator classified this disclosure & permission question as a repeated budget collection question!
  5. `splitInfoAndQuestion` failed to isolate the factual clause because the sentence used em-dash (`—`) rather than `. `.
  6. `buildSanitized` fell back to `ackText + nextQ`, generating:
     `"Ji, aapka budget 80 Lakh humne note kar liya hai. Kya aap is weekend project ka sample flat dekhne ke liye site visit plan karna chahenge?"`
- **Root Cause Classification:** `VERIFIED IN SOURCE` & `VERIFIED BY AUTOMATED TEST`.

---

### P0-2: Canonical Spoken Response & Transcript Mismatch
- **Exact File:** `backend/src/calls/mcube-stream.service.ts`
- **Defective Logic:**
  1. `spokenValidatedSentences.push(validatedSentence)` was called BEFORE TTS synthesis and BEFORE `sendPlayAudio`.
  2. If a customer interrupted with barge-in (`cancelPlay = true`, `flushGen++`), the remaining queued sentences were not played, but they were already in `spokenValidatedSentences`.
  3. `replyText = spokenValidatedSentences.join(' ')` caused un-spoken audio to be recorded in `session.transcript` and `customerMemory.recordTurn`.
  4. `ConversationService.reply()` logged `llmOut`, `McubeStreamService` logged `validatedSentence`, and fallback could overwrite `replyText`, leading to 3 conflicting strings across logs, transcript, and audio.
- **Root Cause Classification:** `VERIFIED IN SOURCE` & `VERIFIED BY AUTOMATED TEST`.

---

### P0-3: Direct Answer Priority vs Sales Conversion
- **Exact Files:** `backend/src/conversation/conversation.service.ts`, `backend/src/memory/question-validator.service.ts`
- **Defective Logic:**
  1. `getNextUnaskedQuestion()` in `QuestionValidatorService` defaulted to `offer_visit` whenever customer profile fields (bhk, budget, purpose) were already populated.
  2. In `ConversationService`, prompt instructions placed qualification questions at the end of each turn, prompting Gemini to pitch site visits even when caller asked for unit sizes or project lists.
- **Root Cause Classification:** `VERIFIED IN SOURCE` & `VERIFIED BY AUTOMATED TEST`.

---

### P1-1: Latency Spikes (Turn 6: 5,899ms)
- **Exact File:** `backend/src/llm/llm.service.ts`
- **Defective Logic:**
  1. In Gemini 2.0 / 2.5 Flash, reasoning/thinking mode is enabled by default unless explicitly disabled with `thinkingConfig: { thinkingBudget: 0 }`.
  2. When conversation history grew to 6 turns, Gemini Flash generated hundreds of internal reasoning tokens before emitting the first text token, taking 3,872ms for first token.
- **Root Cause Classification:** `VERIFIED IN SOURCE` & `VERIFIED BY AUTOMATED TEST`.

---

### P1-2: TTS Telemetry Logging `TTS_first_audio=0ms`
- **Exact File:** `backend/src/calls/mcube-stream.service.ts`
- **Defective Logic:**
  1. Line 827 printed `Latency Metrics` immediately after `this.conversation.reply()` returned.
  2. However, `await ttsChain` was located at line 886!
  3. When line 827 ran, `ttsChain` was still running asynchronously, and `ttsFirstAudioMs` was still 0.
  4. The log printed `TTS_first_audio=0ms` even though TTS audio arrived milliseconds later.
- **Root Cause Classification:** `VERIFIED IN SOURCE` & `VERIFIED BY AUTOMATED TEST`.

---

### P1-3: Opener Repetition on Caller Interruption
- **Exact Files:** `backend/src/calls/mcube-stream.service.ts`, `backend/src/conversation/conversation.service.ts`
- **Defective Logic:**
  1. When call connected, `McubeStreamService` played the contextual opener.
  2. If the caller interrupted and said "Hello", Turn 1 ran.
  3. The prompt explicitly instructed Gemini: *"When caller says Hello at start of call: PITCH THIS EXACT LINE: Namaste [Name] ji! Saya Group mein aapka phir se swaagat hai..."*
  4. Gemini followed this rule and repeated the full welcome greeting.
- **Root Cause Classification:** `VERIFIED IN SOURCE` & `VERIFIED BY AUTOMATED TEST`.
