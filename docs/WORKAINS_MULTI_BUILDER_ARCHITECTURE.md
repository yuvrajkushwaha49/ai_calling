# Workains Reality — Multi-Builder Channel Partner Architecture

**System Architecture Specification**  
**Entity:** Workains Reality  
**Role:** Independent Real Estate Channel Partner  
**AI Advisor:** Aria  

---

## 1. Architectural Philosophy

Traditional real estate AI calling systems are hardwired around a single developer or single project. Workains Reality operates as an **independent multi-builder channel partner**, which requires decoupling the AI identity from any single developer, builder, or property portfolio.

```
       +-------------------------------------------------------+
       |                   Customer (Caller)                   |
       +---------------------------+---------------------------+
                                   | (Telephony μ-law 8000Hz)
       +---------------------------v---------------------------+
       |               MCubeStreamService / Telephony          |
       +---------------------------+---------------------------+
                                   |
       +---------------------------v---------------------------+
       |          Workains Reality AI Channel Partner          |
       |                      (Aria)                           |
       +-------------------+-------------------+---------------+
                           |                   |
        +------------------v-----+       +-----v------------------+
        |  CustomerMemoryService |       |  Multi-Builder Engine  |
        |  - Preferred Builders  |       |  - Rudra Buildwell     |
        |  - Rejected Builders   |       |  - Future World        |
        |  - Preferred Projects  |       |  - VVIP Group          |
        |  - Budget & BHK Specs  |       |  - Saya Group          |
        +------------------------+       |  - Apex / Godrej / etc |
                                         +------------------------+
```

---

## 2. Customer Preference & Rejection Memory Pipeline

### 2.1 State Representation
Every call state (`ConversationState`) maintains dedicated sets for builder and project sentiment:

```typescript
export interface CustomerFacts {
  name?: string;
  phone?: string;
  purpose?: 'end_use' | 'investment';
  bhk?: string;
  budget?: number;
  budgetLabel?: string;
  location?: string;
  timeline?: string;
  possession?: string;
  preferredLocations?: string[];
  preferredBuilders?: string[];
  rejectedBuilders?: string[];
  preferredProjects?: string[];
  rejectedProjects?: string[];
  propertyType?: 'RESIDENTIAL' | 'COMMERCIAL' | 'MIXED';
  sizePreference?: string;
  possessionPreference?: string;
  lastDiscussedProject?: string | null;
  lastDiscussedBuilder?: string | null;
  nextRecommendedProjects?: string[];
  siteVisit?: { ... };
}
```

### 2.2 Intent Extraction Logic (`FactExtractorService`)
When a caller expresses builder preference or rejection (e.g., *"Mujhe Saya Group ka project nahi chahiye, koi doosra option dikhao"*), the pipeline:
1. Matches builder noun (`Saya Group`).
2. Analyzes the subsequent clause within 45 characters.
3. Detects rejection markers (`ka project nahi chahiye`, `nahi lena`, `chodkar`).
4. Adds `'Saya Group'` to `rejectedBuilders`.
5. Emits `builderRejection: true` intent.

---

## 3. Dynamic Multi-Builder Recommendation Logic

### 3.1 Inventory Segmentation
Projects are dynamically queried and categorized:
- **Property Type Isolation:** Residential (Apartments) vs. Commercial (Retail/Shops). Commercial projects are strictly excluded when the caller is looking for residential living.
- **Budget Matching Hierarchy:**
  1. *In-Budget Projects (Starting Price $\le$ Budget):* Recommended first.
  2. *Stretch-Budget Projects (Starting Price > Budget):* Disclosed with upfront price difference and explicit caller consent requested before deep details are shared.
- **Builder Filtering:** Any project whose `builder` is in `rejectedBuilders` is omitted from active recommendation candidates.

### 3.2 Attribution Contract
Every project presented to the customer is accompanied by its authentic developer attribution:
- `Palace Heights [Developer: Rudra Buildwell]`
- `Future Estate [Developer: Future World]`
- `VVIP Pre-Launch [Developer: VVIP Group]`
- `Saya Pre-Launch [Developer: Saya Group]`
- `NCR Monarch [Developer: NCR Group]`

---

## 4. Conversation Guardrails

| Trigger | Standard AI Defect | Workains Reality Channel Partner Behavior |
|---|---|---|
| Customer says *"Mujhe Saya ka nahi chahiye"* | AI apologizes, assumes refusal, and disconnects call. | **Acknowledges politely and pivots:** *"Ji bilkul, koi baat nahi. Main Saya Group ke options hata deti hoon. Aapke liye doosre builders ke projects check karti hoon."* |
| Customer says *"Mujhe Future Estate chahiye"* | AI confuses with "future" timeline or generic acknowledgment. | **Confirms availability immediately:** *"Ji, Future Estate ka project hamari available inventory mein hai. Main aapko uski verified details batati hoon."* |
| Customer asks *"Tum kaun ho?"* | AI claims to be Saya employee. | **Declares Channel Partner status:** *"Ji namaste! Main Workains Reality real estate helpline se Aria baat kar rahi hoon. Hum multiple builders ke residential aur commercial projects provide karte hain."* |
| Customer gives generic ack *"Theek hai"* | AI auto-books appointment on Saturday 11 AM. | **Never books on generic acks:** Requires explicit confirmation of date, time, and project. |
| Customer asks for floor plan/layout | AI repeats site visit pitch. | **Answers sizes and confirms layout:** Offers configuration sizes and promises WhatsApp layout share through team. |
