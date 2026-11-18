# WORKAINS REALITY — TELEPHONY & AUDIO RELIABILITY REPORT

**Date:** 18 November 2026  
**Telephony Interface:** MCube Bidirectional Audio WebSocket  
**Audio Format:** μ-law 8000 Hz / Linear PCM 16-bit 8000 Hz  
**Overall Telephony Status:** `VERIFIED BY AUTOMATED TEST`

---

## 1. 14-Step Telephony Audio Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Caller as Customer
    participant WS as MCube Telephony WS
    participant Pipe as McubeStreamService
    participant STT as ElevenLabs Scribe STT
    participant LLM as Gemini Streaming
    participant TTS as ElevenLabs Flash TTS

    Note over Caller,WS: 1. Audio Transmission
    Caller->>WS: Speaks into phone
    WS->>Pipe: Step 1: CUSTOMER_AUDIO_RECEIVED (media frame)
    Pipe->>STT: Step 2: STT_BEGINS (DC-filtered PCM audio)
    STT-->>Pipe: Step 3: FINAL_TRANSCRIPT_RECEIVED
    
    Note over Pipe,LLM: 2. Response Generation
    Pipe->>LLM: Step 4: GEMINI_GENERATION_BEGINS
    LLM-->>Pipe: First completed sentence chunk
    Pipe->>TTS: Step 5: TTS_BEGINS (synthesis request)
    TTS-->>Pipe: Step 6: AUDIO_CHUNKS_QUEUED
    Pipe->>WS: Step 7: AUDIO_CHUNKS_TRANSMITTED (playAudio payload)
    
    Note over Caller,Pipe: 3. Interruption / Barge-In
    Caller->>WS: Speaks during agent playback
    WS->>Pipe: High energy audio frames
    Pipe->>Pipe: Step 8: CUSTOMER_INTERRUPTS (bargeHits >= 2)
    Pipe->>LLM: Step 9: LLM_GENERATION_ABORTED (AbortController.abort())
    Pipe->>TTS: Step 10: TTS_GENERATION_ABORTED (cancelPlay = true)
    Pipe->>Pipe: Step 11: PENDING_QUEUE_CLEARED (flushGen incremented)
    Pipe->>Pipe: Step 12: STALE_CHUNKS_DISCARDED (gen < flushGen dropped)
    Pipe->>WS: sendClearAudio()
    WS-->>Pipe: Step 13: CLEAR_ACK_RECEIVED (Carrier drain confirmed)
    
    Note over Caller,Pipe: 4. Next Clean Turn
    Pipe->>Pipe: Step 14: NEXT_CUSTOMER_TURN_BEGINS (zero overlap)
```

---

## 2. Verification of Telephony Robustness Controls

| Control | Mechanism | Target Failure Avoided | Verification Status |
| :--- | :--- | :--- | :--- |
| **False Barge-In Filter** | Dual hit verification (`bargeHits >= 2`) | Ambient cough or mic click aborting playback prematurely. | `VERIFIED BY AUTOMATED TEST` |
| **Acoustic Normalization** | Indian 2-comma (`1,50,000 sq.ft.`) & Gaj regex | Hanging commas causing TTS stutter or robotic pronunciation. | `VERIFIED BY AUTOMATED TEST` |
| **RERA Pronunciation** | `UPRERAPRJ...` formatted to `UP RERA PRJ ...` | Unpronounceable alphanumeric TTS reading. | `VERIFIED BY AUTOMATED TEST` |
| **Stale Packet Dropping** | Generational sequence numbering (`flushGen`) | Audio from previous aborted turns leaking into current turn. | `VERIFIED BY AUTOMATED TEST` |
| **Reconnect Session Cache** | In-memory `activeSessions` map with 120s TTL | Network blips causing returning customer session loss mid-call. | `VERIFIED BY AUTOMATED TEST` |
