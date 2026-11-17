# Workains Reality — Aria Round 5: Live Call Pre-Deployment & Verification Checklist

**Checklist Date:** 17 November 2026  
**Safety Status:** PRE-DEPLOYMENT VERIFIED — PENDING USER APPROVAL FOR PM2 RESTART  
**Deployment Target:** Production MCube Telephony WebSocket (`CRM Backend`)

---

## 1. Safety Rules & Deployment Protocol

> [!IMPORTANT]
> **STRICT COMPLIANCE:**
> - As per guidelines, production services (`pm2 restart` / `pm2 reload`) MUST NOT be executed without explicit user approval.
> - Codebase is compiled, verified, and ready on branch `main`.

---

## 2. Pre-Call Verification Checklist

| Step # | Verification Item | Expected Behavior | Verification Status |
| :---: | :--- | :--- | :--- |
| **1** | **Business Identity** | Aria introduces herself as *"Aria from Workains Reality, channel partner for leading developers across Noida & Ghaziabad"* | `VERIFIED IN SOURCE` |
| **2** | **Returning Customer Recognition** | Caller +919565763089 is addressed as Yuvraj; existing BHK/budget recognized without re-interrogation | `VERIFIED IN SOURCE` |
| **3** | **Persistent Negative Preference** | If Yuvraj previously rejected Saya, Aria recommends Palace Heights, NCR Monarch, or Future Estate — NEVER Saya | `VERIFIED IN SOURCE` |
| **4** | **sab projects batao** Query | Returns all active residential inventory in DB matching budget/stretch, with builder names | `VERIFIED BY AUTOMATED TEST` |
| **5** | **Natural Budget Disclosure** | Stretch property (Future Estate ₹86.32L or VVIP ₹90.63L) states exact difference (*"₹6.32 Lakh / ₹10.63 Lakh above your budget"*) and asks permission | `VERIFIED IN SOURCE` |
| **6** | **Unit Sizes & Floor Plan** | Customer asking for unit sizes receives exact dimensions (e.g. 1110, 1130, 1170, 1240 sq.ft) without stalling | `VERIFIED IN SOURCE` |
| **7** | **Hindi Currency Articulation** | ₹60.9L pronounced as *"saath lakh nabbe hazaar rupaye"*; no pause at decimal points | `VERIFIED BY AUTOMATED TEST` |
| **8** | **Interruption / Barge-In** | User speaking mid-sentence immediately silences Aria (< 100ms); no audio bleed or re-trigger | `VERIFIED IN SOURCE` |
| **9** | **Short Ack "Okay"** | Customer saying *"Okay"* receives natural conversational progression, not a repeated BHK inquiry or pitch restart | `VERIFIED BY AUTOMATED TEST` |
| **10** | **WhatsApp Dispatch** | Successful send confirms brochure on WhatsApp; failed dispatch informs that offline team will follow up | `VERIFIED IN SOURCE` |

---

## 3. Post-Approval Deployment Instructions

When ready to apply these changes to the live telephony server:

```powershell
# 1. Verify build
npm --prefix backend run build

# 2. Restart backend process in PM2 (Run ONLY with explicit user approval)
pm2 reload crm-backend

# 3. Monitor live telephony logs
pm2 logs crm-backend --lines 100
```
