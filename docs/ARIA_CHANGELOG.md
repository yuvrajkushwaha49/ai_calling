# Aria Real Estate AI Calling CRM — Changelog

## [2.1.0] - 2026-11-17

### Added
- **15 Automated Core Intelligence Tests (`backend/src/conversation/aria-intelligence.spec.ts`)**:
  - Validates returning customer recognition, budget correction, commercial/residential segregation, anti-repetition interception, barge-in detection, fact persistence, and concurrent call isolation.
- **Smart Anti-Repetition Prefix Preservation (`QuestionValidatorService.splitInfoAndQuestion`)**:
  - Replaces whole-sentence discarding with intelligent clause extraction: conversational and informational prefixes (e.g., *"Ji bilkul, ready-to-move property hi dekhte hain."*) are preserved, and only the redundant question is swapped.
- **Property Type Segregation (`FactExtractorService.extractPropertyType`)**:
  - Distinguishes residential inquiries (flats, apartments, BHK) from commercial inquiries (shops, retail spaces, showrooms, malls, offices).
- **Direct Question Answering Logic (`ConversationService`)**:
  - Injected explicit directives into both standard and phone-latency Gemini system prompts to immediately answer questions such as *"Tumko kaise pata chala mera budget?"* using previous interaction history.
- **Comprehensive Technical Documentation**:
  - `docs/ARIA_CODEBASE_AUDIT.md`: Complete architectural audit, pipeline inspection, and root cause analysis.
  - `docs/ARIA_IMPLEMENTATION_PLAN.md`: Phased execution roadmap with risk mitigation.
  - `docs/ARIA_CONVERSATION_FLOW.md`: State machine diagrams, turn lifecycle, and barge-in dynamics.
  - `docs/ARIA_MEMORY_ARCHITECTURE.md`: Dual-tier Redis/Postgres key schemas, concurrency guarantees, and failover design.
  - `docs/ARIA_TEST_REPORT.md`: Comprehensive verification report for 79 automated test suites.

### Improved
- **Customer Memory Fact Hydration (`CustomerMemoryService`)**:
  - Stamped facts with `source: 'previous_call' | 'current_call' | 'customer' | 'crm' | 'inference'`.
  - Added `previousValue` tracking on fact updates and corrections (e.g. Budget changing from 80 Lakh to 90 Lakh).
  - Derived `factContext` containing `knownFacts`, `missingFacts`, `nextAction`, and `factDetails`.
- **Saya Inventory Categorization (`ConversationService.getProjectsOverview`)**:
  - Explicitly separated catalog into `[RESIDENTIAL PROJECTS]` (Saya Gold Avenue, Saya Zenith, Saya Zion) and `[COMMERCIAL PROJECTS]` (Saya South X, Saya Piazza).
- **Question Validator (`QuestionValidatorService`)**:
  - Added missing `location` question to `getNextUnaskedQuestion`.
  - Prevented asking customer name if the lead name is a placeholder (e.g. `"Lead 3089"`).

### Fixed
- **BHK & Budget Repetition Bug**:
  - Addressed root cause where returning customers were greeted about their requirement and then immediately re-asked for BHK and budget.
- **Commercial vs Residential Cross-Recommending**:
  - Prohibited AI from proposing retail shop units when the customer expressed interest in residential apartments.
- **Build & Typing Compatibility**:
  - Extended `ConversationFactContext.factDetails` with `previousValue?: any`.
  - Exported and imported `isPlaceholderLeadName` in question validation.

### Preserved
- 8kHz μ-law telephony WebSocket contracts (`/bid/websocket/{callId}`).
- ElevenLabs Flash v2.5 low-latency streaming TTS integration.
- Existing Prisma schema models (`Lead`, `Call`, `ConversationMemory`).
- Redis cache keys (`customer:{phone}`, `customer:{phone}:summary`, `call:{callId}:memory`, `call:{callId}:history`).
