# WORKAINS REALITY — ARIA ROUND 7 INVENTORY ACCURACY REPORT
**Project:** Workains Reality — AI Calling CRM  
**Agent:** Aria (Independent Multi-Builder Channel Partner Helpline Advisor)  
**Round:** 7  
**Date:** November 17, 2026  
**Auditor:** Senior Real Estate AI Voice Architect & Production Systems Engineer  

---

## 1. CRM INVENTORY RECONCILIATION

Every project fact spoken by Aria must originate from the CRM database (`Prisma.Project`) or verified canonical inventory metadata. The audit reconciled database seeds against spoken claims:

### Canonical Project Inventory Table

| Project Name | Actual Builder / Developer | Property Type | Starting Price | Verified BSP | Verified Sizes | Verified Clubhouse Area | RERA Status |
|---|---|---|---|---|---|---|---|
| **Palace Heights by Rudra** | Rudra Buildwell (Mukesh Khurana) | Residential Apartment | ₹60.90 Lakh (₹60,90,000) | ₹8,700/sq.ft | 1 BHK (700 sq.ft), 2 BHK (1015, 1088 sq.ft), 3 BHK (1341-1568 sq.ft), 4 BHK (1841-2285 sq.ft) | 30,000 sq.ft clubhouse | `UPRERAPRJ11124` |
| **NCR Monarch** | JSS Buildcon Pvt Ltd / NCR Group | Residential Apartment | ₹63.99 Lakh (₹63,99,360) | ₹8,888/sq.ft | 1 BHK (720-1010 sq.ft), 2 BHK (1075, 1255 sq.ft), 3 BHK (1345-1810 sq.ft) | Modern clubhouse & sports facilities | `UPRERAPRJ11125` |
| **Future Estate by Future World** | Future World Green Homes | Residential Apartment | ₹86.32 Lakh (₹86,32,470) | ₹7,777/sq.ft | 2 BHK (1110, 1130, 1170, 1240 sq.ft), 2+Study (1335 sq.ft), 3 BHK (2050 sq.ft), 4 BHK (2500 sq.ft) | 2 Clubhouses (32,000 sq.ft + 10,000 sq.ft) | `UPRERAPRJ11126` |
| **VVIP Pre-Launch** | VVIP Group | Residential Apartment | ₹90.63 Lakh (₹90,62,500) | ₹7,250/sq.ft | 2 BHK (1250 sq.ft), 3 BHK (1800 sq.ft), 4 BHK (2400 sq.ft) | 60,000 sq.ft modern clubhouse | Under Verification |
| **Saya Pre-Launch** | Saya Group | Residential Apartment | ₹69.00 Lakh (₹69,00,000) | ₹6,900/sq.ft | 2 BHK (1000 sq.ft), 2+S BHK (1200 sq.ft), 3 BHK (1400-1800 sq.ft) | Large modern clubhouse | `UPRERAPRJ11133` |

---

## 2. INVESTIGATION OF OBSERVED LIVE-CALL CLAIMS

During prior calls, Aria recited three specific figures:
1. `1000 sq.ft.`
2. `₹69 lakh.`
3. `1,50,000 sq.ft. mega luxury clubhouse.`

### Root Cause & Evidence:
- **Origin:** These values belonged to `Saya Pre-Launch` (Ghaziabad), hardcoded in [conversation.service.ts](file:///d:/Yuvi/Piyush%20React/ai_calling/backend/src/conversation/conversation.service.ts#L1516-L1520) and fallback arrays.
- **Why Spoken:** The customer in that call had previously expressed a desire to avoid Saya Group, but because the conversation continuity engine had not locked onto the caller's discussed property (Palace Heights), `getProjectsOverview()` served the lowest starting-price residential project (₹69L Saya Pre-Launch).
- **Remediation Implemented:**
  1. `getProjectsOverview()` strictly filters out all Saya Group projects whenever `rejectedBuilders` contains `'Saya Group'`.
  2. `Project Context Lock` forces Aria to stay locked onto Palace Heights (or any customer-selected project) without falling back to alternative developers.
  3. Hyperbolic superlatives (*"mega luxury clubhouse"*) are removed from canonical fallback definitions.
- **Verification Status:** `VERIFIED BY AUTOMATED TEST`

---

## 3. STRICT COMPLIANCE RULES VERIFICATION

1. **Independent Channel Partner Identity:** Workains Reality is strictly identified as an independent multi-builder channel partner. Aria never claims Workains Reality is the developer of Palace Heights or NCR Monarch.
   - *Status:* `VERIFIED IN SOURCE`
2. **Strict Budget Matching:** Properties exceeding the customer's stated budget (e.g. Future Estate at ₹86.32L or VVIP at ₹90.63L for an ₹80L budget) are flagged with upfront price differences and permission is requested prior to elaboration.
   - *Status:* `VERIFIED BY AUTOMATED TEST`
3. **No Fabricated Amenities:** Inquiries regarding specific fixtures, kitchen fittings, or balcony dimensions not in the database trigger the verified deferral response: *"Is specific detail ki verified information main team se confirm karke WhatsApp par share karwa doongi."*
   - *Status:* `VERIFIED BY AUTOMATED TEST`
4. **RERA Integrity:** Verified RERA numbers (`UPRERAPRJ11124`, `UPRERAPRJ11125`) are provided when present; missing RERA records are not fabricated.
   - *Status:* `VERIFIED BY AUTOMATED TEST`
