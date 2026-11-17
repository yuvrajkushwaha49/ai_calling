# WORKAINS REALITY — BUSINESS IDENTITY & CODEBASE AUDIT

**Date:** 17 November 2026  
**Auditor:** Senior Real Estate AI Voice Architect  
**Transformation:** Single-Developer (Saya Group) ➔ Independent Multi-Builder Channel Partner (Workains Reality)

---

## 1. Executive Summary

This audit evaluates the codebase to transition the system from a single-builder representation (Saya Group / RGBIL) to **Workains Reality**, an **Independent Real Estate Channel Partner** representing multiple builders across Delhi NCR.

### Core Distinctions
- **Workains Reality:** The marketing entity / channel partner advisory firm.
- **Builders / Developers:** The actual project owners (e.g. *Saya Group*, *Rudra Buildwell*, *Future World / FW Group*, *VVIP Group*, *Divyansh*, *Apex Group*, *Godrej Properties*, *Sobha*, *Gulshan Homz*).
- **Project Inventory:** Saya projects remain active as one valid builder option among many.
- **Historical Conversations:** Existing customer call logs and transcripts remain untouched.

---

## 2. Codebase Reference Categorization

Every occurrence of "Saya", "RGBIL", and company identity across the repository is classified into four operational categories:

### Category A: Company Identity (MUST be updated to Workains Reality)
These references represent the voice assistant's employer / identity:
1. `backend/src/calls/mcube-stream.service.ts`:
   - Outbound and inbound voice opener introductions: `"Main Aria, Saya Group (RGBIL) se..."` ➔ `"Main Aria, Workains Reality se bol rahi hoon..."`.
2. `backend/src/calls/opener-bank.ts`:
   - Default company name in telephone opener bank: `'Saya Group'` ➔ `'Workains Reality'`.
   - `speakCompanyName()` fallback ➔ `'Workains Reality'`.
3. `backend/src/ai/ai.service.ts`:
   - `loadSettings()` default `companyName`: `'Workains Reality'`, `agentName`: `'Aria'`.
4. `backend/src/conversation/conversation.service.ts`:
   - System prompts and fallback greetings representing the advisory identity.
5. `backend/src/calls/call-scripts.ts`:
   - `greeting_inbound`, `explain_why_call`, `liveness_ack` default company representation.
6. `backend/src/whatsapp/whatsapp.service.ts`:
   - Brochure & floor plan sharing footer: `"Shared by Workains Reality, Channel Partner for [Project]"`.
7. `frontend/src/app/layout.tsx` & `frontend/src/app/(auth)/login/page.tsx` & `frontend/src/components/layout/sidebar.tsx`:
   - Branding headers, titles, and subheadings updated to Workains Reality.

### Category B: Developer / Builder Representation (MUST be preserved per project)
These references correctly identify the actual builder behind each project and must NOT be replaced with Workains Reality:
1. `backend/prisma/schema.prisma` (`model Project`):
   - `builder`: Identifies the actual project developer (e.g. `Saya Group`, `FW Group`, `Rudra Buildwell`).
2. `backend/src/conversation/conversation.service.ts` (`Available Projects`):
   - `Saya South X`: Developer remains **Saya Group**.
   - `Saya Piazza`: Developer remains **Saya Group**.
   - `Saya Pre-Launch / Raj Nagar Extension`: Developer remains **Saya Group**.
   - `Palace Heights`: Developer remains **Rudra Buildwell**.
   - `Future Estate`: Developer remains **Future World / FW Group**.
   - `VVIP Pre-Launch / Namah`: Developer remains **VVIP Group**.
   - `Aarya Heights`: Developer remains **Divyansh**.
   - `NCR Monarch`: Developer remains **NCR Group**.

### Category C: Historical Customer Conversations (READ-ONLY / PRESERVED)
Past call transcripts and call memory must remain completely unaltered:
1. `Call.transcript` records in PostgreSQL.
2. `CallLog.fullResponse` and past memory entries.
3. Historical tests (`aria-round2-regression.spec.ts`, `aria-critical-fixes.spec.ts`) asserting historical regression behaviors.

### Category D: Project Inventory & Recommendation Logic (UPGRADED)
1. Match engine must evaluate all suitable builders without bias toward Saya Group.
2. When customer rejects Saya Group, Aria must acknowledge gracefully and continue with alternative builders.
3. When customer asks for Future Estate, VVIP, or Rudra, Aria must confirm availability from Workains Reality's portfolio.

---

## 3. Findings Matrix

| File Path | Current Content | Classification | Planned Action |
|---|---|---|---|
| `backend/src/calls/mcube-stream.service.ts:326` | Default `Saya Group` / `RGBIL` in opener | Category A | Change to `Workains Reality`, use `speakAgentName()` |
| `backend/src/calls/opener-bank.ts:250` | `speakCompanyName` returning `Saya Group` | Category A | Return `Workains Reality` |
| `backend/src/calls/call-scripts.ts:1445` | `Main Saya Group helpline se...` | Category A | Update to `Main Workains Reality helpline se...` |
| `backend/src/calls/call-scripts.ts:1238` | `nahi chahiye` marks `notInterested=true` | Category D | Add `isProjectRejection` guard so builder rejection is not a call disconnect |
| `backend/src/memory/fact-extractor.service.ts:46` | Bare `\|साया` in project patterns | Category D | Disambiguate project name and add negation detection for `rejectedProjects` / `rejectedBuilders` |
| `backend/src/memory/customer-memory.service.ts` | Stores only `interestedProjects` | Category D | Add `preferredBuilders`, `rejectedBuilders`, `preferredProjects`, `rejectedProjects` |
| `backend/src/llm/llm.service.ts:216` | Unconditional `thinkingConfig` | Bug | Guard `thinkingConfig` for thinking models only (prevents 400 INVALID_ARGUMENT) |
| `frontend/src/app/layout.tsx` | `RealEstate AI Calling CRM` | Category A | Update to `Workains Reality — Channel Partner CRM` |
| `frontend/src/components/layout/sidebar.tsx` | Generic RealEstate branding | Category A | Brand as `Workains Reality` |
| `frontend/src/app/(auth)/login/page.tsx` | Generic login header | Category A | Brand as `Workains Reality — Channel Partner Portal` |
| `backend/prisma/seed.ts` | Default seed projects | Category B | Ensure projects reflect actual builders (Saya, Rudra, Future World, VVIP) |

---

## 4. Architectural Transformation Plan

```
                   [Workains Reality]
         (Independent Real Estate Channel Partner)
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
      [Residential Portfolio] [Commercial Portfolio]
             │                       │
 ┌───────────┼───────────┐           ┌───────────┐
 ▼           ▼           ▼           ▼           ▼
Future World Rudra      VVIP       Saya Group  Saya Group
(Future Est)(Palace H)  (Namah)    (South X)   (Piazza)
```

1. **Aria's Persona:** Real Estate Channel Partner Advisor representing multiple verified developers.
2. **Neutrality:** Transparent pricing, objective builder comparisons, and zero developer bias.
3. **Rejection Handling:** Builder rejections update customer memory filters and seamlessly pivot to other available builders in inventory.

