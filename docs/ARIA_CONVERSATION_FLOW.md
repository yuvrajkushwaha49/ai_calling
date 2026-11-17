# Aria Conversational Flow & State Machine Architecture

## 1. Executive Summary

This document specifies the conversation lifecycle, turn processing mechanics, routing hierarchy, and fallback mechanisms for **Aria**, the AI Real Estate Sales Advisor representing **Saya Group**.

Aria is built to operate over bidirectional 8kHz μ-law WebSocket audio streams (MCube telephony) with sub-second response times. Her conversational flow balances structured sales qualification with fluid, human-like dialogue, ensuring no repetitive questioning and strict factual adherence.

---

## 2. High-Level Turn Pipeline Flowchart

```mermaid
flowchart TD
    A[Incoming Audio Packet via MCube WS] --> B[VAD & Noise Gate Check]
    B -- Below Voice Threshold --> C[Discard Packet]
    B -- Speech Detected --> D[Real-time STT / ElevenLabs STT]
    D --> E[Customer Utterance Extracted]
    E --> F[Fact Extractor & Intent Classifier]
    F --> G{Customer Objection / Interruption?}
    G -- Yes --> H[Cancel Pending TTS / Audio Buffer]
    H --> I[Update Customer Memory & State]
    G -- No --> I
    I --> J{Fast Script Match?}
    J -- Yes --> K[Generate Fast Script Template Response]
    J -- No --> L[Build Grounded LLM Prompt with Memory Context]
    L --> M[Gemini Streaming LLM Generation]
    M --> N[First Chunk / Complete Utterance]
    K --> O[Question Validator & Anti-Repetition Sanitizer]
    N --> O
    O --> P{Repeated Question Detected?}
    P -- Yes --> Q[Preserve Statement + Swap Clause with Next Unasked Attribute]
    P -- No --> R[Approved Clean Response]
    Q --> R
    R --> S[ElevenLabs Flash v2.5 TTS Synthesis]
    S --> T[Chunked Audio Transmission via MCube WS]
```

---

## 3. Conversational State Machine

```mermaid
stateDiagram-v2
    [*] --> GREETING_INITIALIZATION

    state GREETING_INITIALIZATION {
        [*] --> PROFILE_LOOKUP
        PROFILE_LOOKUP --> RECOGNIZED_CALLER: Cache/DB Hit
        PROFILE_LOOKUP --> NEW_CALLER: No Record Found
        RECOGNIZED_CALLER --> PITCH_RETURNING_OPENER
        NEW_CALLER --> PITCH_NEW_OPENER
    }

    GREETING_INITIALIZATION --> DISCOVERY_STAGE: Customer Responds

    state DISCOVERY_STAGE {
        [*] --> CHECK_DIRECT_QUESTION
        CHECK_DIRECT_QUESTION --> ANSWER_DIRECT: Customer Asked "Kaun/Kyu/Price/Source"
        CHECK_DIRECT_QUESTION --> EVALUATE_KNOWN_FACTS: Standard Response
        ANSWER_DIRECT --> EVALUATE_KNOWN_FACTS
        EVALUATE_KNOWN_FACTS --> ASK_NEXT_FACT: Missing BHK / Budget / Location / Purpose
    }

    DISCOVERY_STAGE --> RECOMMENDATION_STAGE: Core Facts Gathered (BHK + Budget/Location)

    state RECOMMENDATION_STAGE {
        [*] --> FILTER_INVENTORY
        FILTER_INVENTORY --> PITCH_MATCHED_PROJECT: Residential vs Commercial Segregated
        PITCH_MATCHED_PROJECT --> HANDLE_CUSTOMER_QUERY
    }

    RECOMMENDATION_STAGE --> CLOSING_STAGE: Positive Interest Confirmed
    DISCOVERY_STAGE --> OBJECTION_HANDLING: Customer Refuses or Defers
    RECOMMENDATION_STAGE --> OBJECTION_HANDLING: Customer Disagrees / Refuses Site Visit

    state OBJECTION_HANDLING {
        [*] --> DETECT_OBJECTION_TYPE
        DETECT_OBJECTION_TYPE --> SOFT_CALLBACK: "Abhi time nahi hai / Baad mein"
        DETECT_OBJECTION_TYPE --> HARD_REFUSAL: "Nahi chahiye / Phone rakho"
        SOFT_CALLBACK --> AGREE_CALLBACK
        HARD_REFUSAL --> POLITE_EXIT
    }

    AGREE_CALLBACK --> CALL_TERMINATION
    POLITE_EXIT --> CALL_TERMINATION
    CLOSING_STAGE --> CALL_TERMINATION

    state CALL_TERMINATION {
        [*] --> FLUSH_MEMORY_TO_REDIS
        FLUSH_MEMORY_TO_REDIS --> PERSIST_TO_POSTGRES
        PERSIST_TO_POSTGRES --> [*]
    }
```

---

## 4. Step-by-Step Stage Specifications

### Stage 1: Call Initialization & Customer Recognition
1. **Audio Handshake:**
   - MCube opens WebSocket at `/bid/websocket/{callId}`.
   - Initial 500ms calculates ambient noise floor to dynamically calibrate energy threshold (default ~450, auto-scaled up to 700 in noisy lines).
2. **Identity Resolution:**
   - Phone number normalized via `normalizePhoneNumber(rawPhone)`.
   - Redis profile queried at `customer:{phone}` (TTL 3600s).
   - If Redis miss, PostgreSQL queried (`prisma.lead.findFirst`).
3. **Opener Selection:**
   - **Returning Customer:** Recognizes name, previous BHK, budget, and call history. Welcomes back warmly:
     - *Hinglish:* `"Namaste [Name] ji! Saya Group mein aapka phir se swaagat hai. Pichhli baar hamari baat [2 BHK] ko lekar hui thi — kya aaj usi ke regarding baat karna chahenge ya kuch naya dekhna hai?"`
     - All previous facts stamped with `source: 'previous_call'`.
   - **New Customer:** Neutral polite greeting without assuming name or requirements:
     - *Hinglish:* `"Haan ji namaste! Saya Group helpline mein aapka swaagat hai. Main Aria baat kar rahi hoon, bataiye main aapki kya sahayata kar sakti hoon?"`

### Stage 2: Direct Question Answering vs Qualification Discovery
When the customer responds, Aria classifies their intent before deciding whether to ask a question:
- **Direct Question Priority:**
  - If customer asks *"Aap kaun bol rahe ho?"* ➔ Identify Aria and Saya Group immediately.
  - If customer asks *"Tumko kaise pata chala mera budget 80 Lakh hai?"* ➔ Explain directly: *"Ji pichhli call par humari baat hui thi, tabhi se system mein record hai."*
  - If customer asks about pricing or inventory ➔ Answer with factual ranges before asking follow-ups.
- **Qualification Rule:**
  - At most **ONE** question per turn.
  - Never ask for an attribute that already exists in `factContext.knownFacts`.

### Stage 3: Inventory Presentation & Segregation
- **Residential Segregation:**
  - Residential queries (flats, apartments, BHK) only map to:
    - *Saya Gold Avenue* (Indirapuram, Ready to Move, 2/3/4 BHK)
    - *Saya Zenith* (Indirapuram, 2/3/4 BHK)
    - *Saya Zion* (Greater Noida West, 2/3/4 BHK)
    - *Saya South X (Residential/Suites)* (Greater Noida West)
- **Commercial Segregation:**
  - Commercial queries (shops, retail, offices, food court) strictly map to:
    - *Saya South X* (Greater Noida West, High Street Retail)
    - *Saya Piazza* (Jaypee Wish Town, Sector 131 Noida)
  - Commercial projects are **never** offered to callers seeking residential homes.

### Stage 4: Anti-Repetition Sanitization Layer
Before any generated response reaches TTS:
1. `QuestionValidatorService.validateAndSanitize(response, state)` evaluates the text against regex detectors (`bhk`, `budget`, `purpose`, `location`, `timeline`).
2. If the response contains a question for an already-known fact:
   - `allowed = false`.
   - The informational statement/prefix is preserved.
   - The redundant question clause is stripped and replaced with `getNextUnaskedQuestion(state)` (e.g. asking for missing location or possession).
   - Logged with `[Anti-Repetition]` warning.

### Stage 5: Interruption & Barge-In Handling
1. While Aria is speaking, incoming audio is continuously analyzed for speech energy above `bargeThreshold` (~900).
2. Upon customer speech confirmation (energy sustained > 200ms):
   - Active TTS stream to ElevenLabs is immediately aborted.
   - MCube `clearAudio` or playback flush signal is issued.
   - Telephony stream clears pending buffers.
   - Customer utterance is transcribed and fed into the turn pipeline without latency accumulation.

### Stage 6: Call Termination & Persistence
1. Customer says goodbye or disconnects WebSocket.
2. `CustomerMemoryService.persistMemoryToDb(callId)` executes:
   - Upserts `ConversationMemory` with `customerFacts`, `answeredFields`, `askedQuestions`.
   - Updates `Lead` table with verified requirements.
   - Updates Redis profile cache `customer:{phone}` for future returning calls.
