# Aria Real Estate Project Data Verification

## Executive Summary

To prevent AI hallucination during live customer calls (such as inventing floor counts, land sizes, or specific fittings), this document establishes the verified project source of truth extracted from CRM records and project documentation (`backend/scripts/reset-and-seed-projects.js` and `seed-all-pdf-projects.js`).

---

## 1. Verified Inventory & Project Specifications

### 1. Palace Heights by Rudra
- **Builder / Company:** Rudra Buildwell / Saya Group
- **Location:** Plot GH-02B, Sector 1, Greater Noida West (Noida Extension), UP
- **Property Type:** Residential Luxury Apartments
- **RERA Number:** UPRERAPRJ11129
- **Pricing:**
  - Base Selling Price (BSP): ₹8,700 / sq.ft
  - Starting Price: ₹60.9 Lakh (1 BHK fully furnished)
- **Verified Configurations & Unit Sizes:**
  - **1 BHK:** 700 sq.ft (fully furnished)
  - **2 BHK:** 1015 sq.ft & 1088 sq.ft
  - **3 BHK:** 1341 sq.ft & 1568 sq.ft
  - **4 BHK:** 1841 sq.ft & 2285 sq.ft
- **Amenities & Features:** 30,000 sq.ft modern clubhouse, 70% landscaped green area, 3 towers with possession in 6 months, 50:50 payment plan.

---

### 2. NCR Monarch
- **Builder / Company:** NCR Group
- **Location:** Plot GH-02C, Sector 1, Greater Noida West (Noida Extension), UP
- **Property Type:** Residential Luxury Apartments & Commercial High-Street Shops
- **RERA Number:** UPRERAPRJ11128
- **Pricing:**
  - Base Selling Price (BSP): ₹8,888 / sq.ft
  - Starting Price: ₹64 Lakh onwards
- **Verified Configurations & Unit Sizes:**
  - **1 BHK:** 720 sq.ft & 1010 sq.ft
  - **2 BHK:** 1075 sq.ft & 1255 sq.ft
  - **3 BHK:** 1345 sq.ft & 1810 sq.ft
- **Commercial:** Retail shops and society market available on ground and first floors.

---

### 3. Saya Pre-Launch
- **Builder / Company:** Saya Promoter LLP (Vikas Bhasin / Saya Group)
- **Location:** Raj Nagar Extension, Ghaziabad, UP
- **Property Type:** Residential Mega Luxury Apartments
- **RERA Number:** UPRERAPRJ11133
- **Pricing:**
  - Base Selling Price (BSP): ₹6,900 / sq.ft
  - Starting Price: ₹69 Lakh (2 BHK 1000 sq.ft)
- **Land & Towers:** 18 Acres, 17–18 Towers (G+22–25 floors, 2200 units, 4–6 flats/floor, 2–3 lifts/floor).
- **Clubhouse:** 1,50,000 sq.ft mega luxury clubhouse (largest in the region).
- **Verified Configurations & Unit Sizes:**
  - **2 BHK:** 1000 sq.ft (EOI ₹8 Lakh, starting ₹69 Lakh)
  - **2 BHK + Study:** 1200 sq.ft
  - **3 BHK:** 1400 sq.ft & 1600 sq.ft (EOI ₹10 Lakh)
  - **3 BHK Large:** 1800 sq.ft
  - **4 BHK:** 2600 sq.ft (EOI ₹15 Lakh)
- **Payment Plan:** 20*5 plan (20% on RERA, 20% on rafting, 20% on 10th floor, 20% on superstructure, 20% on possession).

---

### 4. Future Estate by Future World
- **Builder / Company:** FW Group (Future World Green Homes Pvt Ltd)
- **Location:** Plot No. 16 E, Sector 1, Greater Noida West, UP 201318
- **Property Type:** Residential Apartments
- **RERA Number:** UPRERAPRJ11130
- **Funding:** SWAMIH Investment Fund managed by SBICAP Ventures
- **Pricing:**
  - Base Selling Price (BSP): ₹7,777 / sq.ft (Pre-launch Tower DEF: ₹9,500 / sq.ft)
  - Starting Price: ₹86.32 Lakh (1110 sq.ft @ ₹7,777)
- **Land & Towers:** 7.9 Acres, 9 Towers (Phase 1: 6 towers, Phase 2: 3 towers; Tower A: G+10, others: S+22 floors, 852 units).
- **Clubhouses:** 2 Clubhouses (32,000 sq.ft Social Club + 10,000 sq.ft Sports Club), 2.5 Acre green belt.
- **Verified Configurations & Unit Sizes:**
  - **2 BHK:** 1110 sq.ft, 1130 sq.ft, 1170 sq.ft, 1240 sq.ft
  - **2 BHK + Study:** 1335 sq.ft
  - **2 BHK + Lounge:** 1435 sq.ft
  - **Pre-Launch Tower DEF:** 3 BHK (2050 sq.ft), 4 BHK (2500 sq.ft)
- **Payment Plans:** 50:50 subvention, 20:80 possession plan.

---

### 5. VVIP Pre-Launch
- **Builder / Company:** Vibhor Vaibhav Infra Homes Pvt Ltd (VVIP Group)
- **Location:** Raj Nagar Extension, Ghaziabad, UP
- **Property Type:** Residential Apartments & Commercial Shops
- **RERA Number:** UPRERAPRJ11132
- **Pricing:**
  - Base Selling Price (BSP): ₹7,250 / sq.ft
  - Starting Price: ₹90.625 Lakh (~₹91 Lakh, 1250 sq.ft @ ₹7,250)
- **Land & Towers:** 5 Acres, 5 Towers, G+30 Floors, 750 total units (5 flats/floor, 4 high-speed lifts/floor), 3-side open corner plot.
- **Clubhouse:** 60,000 sq.ft modern luxury club.
- **Verified Configurations & Unit Sizes:**
  - **2 BHK:** 1250 sq.ft (EOI ₹5 Lakh, ~₹90.6L - ₹91L)
  - **3 BHK:** 1800 sq.ft (EOI ₹7.5 Lakh)
  - **4 BHK:** 2400 sq.ft (EOI ₹10 Lakh)
- **Commercial Shops:** Ground Floor ₹24,000/sq.ft, Middle Floor ₹16,000/sq.ft, Top Floor ₹12,000/sq.ft.
- **Payment Plan:** 40% RERA, 30% Top Floor, 20% Lift, 10% Possession.

---

### 6. Commercial Inventory: Saya Piazza & Saya South X
- **Saya Piazza (Noida Expressway):** Commercial high-street retail shops and restaurants from ₹49 Lakh onwards.
- **Saya South X (Greater Noida West):** Commercial retail shops, dining, and family entertainment zone from ₹55 Lakh onwards.
- **Rule:** Never pitch commercial properties to customers looking for residential flats/apartments unless explicitly requested.

---

## 2. Anti-Hallucination & Verification Rules

1. **Exact Prices Only:** Never invent or guess starting prices. Always quote verified CRM BSP and starting prices.
2. **Budget Permission:** If a property exceeds customer budget (e.g. Future Estate ₹86.3L or VVIP ₹90.6L for an ₹80L budget), state the exact price difference upfront and ask permission before describing.
3. **No Unbacked Fixture Claims:** Never claim specific brands for modular kitchens, air conditioners, or specific balcony fittings unless documented in project specifications.
4. **Missing Detail Protocol:** When asked about unverified specifications, reply: *"Is specific detail ki verified information main team se confirm karke WhatsApp par share karwa doongi."*
