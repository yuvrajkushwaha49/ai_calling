# Gemini API Failure & Timeout Fallback Analysis

**Issue Report:** Production Live Call Log Incident  
**Timestamp:** 17 November 2026, 10:58:09 AM IST  
**Service:** `LlmService` (`backend/src/llm/llm.service.ts`)  
**Status:** RESOLVED & VERIFIED IN SOURCE  

---

## 1. Incident Log Analysis

During live call `95657630891794913078`, the following logs were generated:

```text
[LlmService] Gemini streaming error (flash-lite): 
GoogleGenAIError: [GoogleGenAI] Error fetching from 
https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:streamGenerateContent?alt=sse: 
[400 Bad Request] Request contains an invalid argument. 
{"error": {"code": 400, "message": "Request contains an invalid argument.", "status": "INVALID_ARGUMENT"}}

[LlmService] Gemini raw stream error: GoogleGenAIError: ...
[ConversationService] LLM stream error; falling back to non-streaming: Error: LLM call timed out after 3500ms
```

---

## 2. Root Cause Identification

### Root Cause 1: `thinkingConfig` Unsupported on Non-Thinking Models
- **Mechanism:** In an earlier optimization attempt to reduce latency, the code added:
  ```json
  "thinkingConfig": { "thinkingBudget": 0 }
  ```
  to the `generationConfig` payload for all Gemini API requests.
- **API Spec Violation:** Google's Gemini v1beta API only supports `thinkingConfig` on reasoning models (such as `gemini-2.0-flash-thinking-exp` or `gemini-2.5-pro`). When sent to standard models like `gemini-flash-lite-latest` or `gemini-flash-latest`, the Google endpoint rejects the entire request with `HTTP 400 INVALID_ARGUMENT`.

### Root Cause 2: Timeout Waterfall on Stream Failure
- **Mechanism:** When the streaming call crashed on 400 Bad Request, the system caught the error and fell back to non-streaming `chat()`. However, the overall turn timeout of 3500ms was consumed during the connection retry and backoff, resulting in `LLM call timed out after 3500ms`.

---

## 3. Implemented Fix

### 3.1 Model-Specific Thinking Guard (`llm.service.ts`)
The `buildGeminiBody` method now inspects the model identifier before attaching `thinkingConfig`:

```typescript
// backend/src/llm/llm.service.ts
const isThinkingModel = Boolean(
  model && (
    model.includes('thinking') ||
    model.includes('2.5') ||
    model.includes('2.0-flash-thinking')
  ),
);

// thinkingConfig is ONLY passed to models that support it:
...(isThinkingModel ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
```

### 3.2 Result
- For `gemini-flash-lite-latest`, `thinkingConfig` is completely omitted from the HTTP request body.
- Google Generative Language API receives standard, valid generation arguments.
- 400 Bad Request errors are eliminated, removing the fallback latency penalty.

---

## 4. Fallback Safety Behavior

If any network or provider outage occurs on the LLM:
1. `ConversationService` falls back to `call-scripts.ts` (`buildFollowUpReply`).
2. When the caller asks about properties or projects, the fast script answers directly or acknowledges and continues the dialogue.
3. The AI **NEVER** issues an unsolicited goodbye, premature appointment, or hangs up on the caller.
