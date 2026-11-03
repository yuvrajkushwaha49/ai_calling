const { PrismaClient, PropertyType, KnowledgeSourceType, KnowledgeStatus } = require('@prisma/client');
const prisma = new PrismaClient();

const PDF_PROJECTS = [
  // 1. FUTURE ESTATE BY FUTURE WORLD
  {
    name: 'FUTURE ESTATE BY FUTURE WORLD',
    companyName: 'Future World Green Homes Pvt Ltd',
    builder: 'Ankit Sharma, Ankit Mathur, Dipin Arora',
    location: 'Plot No 16 E, Sector 1, Greater Noida West, UP 201318',
    propertyType: PropertyType.APARTMENT,
    startingPrice: 8632470, // 1110 sq.ft @ 7777
    endingPrice: 23750000, // 2500 sq.ft @ 9500
    possessionDate: new Date('2027-06-01'),
    reraNumber: 'UPRERAPRJ11130',
    amenities: ['32,000 Sq.Ft Social Club', '10,000 Sq.Ft Sports Club', '2.5 Acre Green Belt', '2-Side Open Plot', '48 Society Shops (G+3 Sold Out)'],
    description: 'Future Estate by Future World in Sector 1 Greater Noida West features 9 towers on 7.9 acres. Tower A G+10, rest S+22 floors (852 units). 2 BHK (1110-1240 sq.ft), 2 BHK + Study (1335 sq.ft), 2 BHK + Lounge (1435 sq.ft), Pre-launch Tower DEF: 3 BHK (2050 sq.ft), 4 BHK (2500 sq.ft). BSP ₹7,777/sq.ft (Tower DEF ₹9,500). Funded by SWAMIH (SBI Cap Ventures). Payment plans: 50:50 subvention, 20:80.',
    chunks: [
      `PROJECT: FUTURE ESTATE BY FUTURE WORLD
LOCATION: Plot No 16 E, Sector 1, Greater Noida West, UP 201318.
BUILDER: FW Group (Future World Green Homes Pvt Ltd). Owners: Ankit Sharma, Ankit Mathur, Dipin Arora.
LAND & TOWERS: 7.9 Acres, 9 Towers (Phase 1: 6 towers, Phase 2: 3 towers). Tower A G+10, others S+22 floors. Total 852 units.
AMENITIES: 2 Clubhouses (32,000 sq.ft Social Club + 10,000 sq.ft Sports Club), 2.5 Acre green belt maintained by builder, 48 society shops.
PROJECT FUNDED BY: SWAMIH Fund managed by SBI CAP Ventures.`,
      `FUTURE ESTATE - CONFIGURATIONS & PRICING:
- 2 BHK: 1110, 1130, 1170, 1240 Sq.Ft
- 2 BHK + Study: 1335 Sq.Ft
- 2 BHK + Lounge: 1435 Sq.Ft
- Pre-launch Tower DEF (EOI ₹10 Lac, BSP ₹9,500): 3 BHK (2050 Sq.Ft), 4 BHK (2500 Sq.Ft)
BSP PRICE: ₹7,777 / Sq.Ft (Tower DEF ₹9,500 / Sq.Ft)
OTHER CHARGES: Club Membership ₹3 Lakhs, Lease Rent ₹85/sq.ft, IFMS ₹30/sq.ft, Park Facing ₹150/sq.ft, Farmer Comp ₹99/sq.ft, GST 5%.
PAYMENT PLANS: 50 Now 50 on Offer of Possession (Subvention) | 20 Now 80 on Offer of Possession.
BANK DETAILS: Cheque in favour of "FUTURE WORLD GREEN HOMES". Loans from all banks.
VICINITY: ATS Destinaire, Ace Divino, Antriksh Golf Links, Vihaan Greens, Arihant Amber, Nirala Grand Reserve, Ace City, NCR Monarch.`
    ]
  },

  // 2. AARYA HEIGHTS BY DIVYANSH GROUP
  {
    name: 'AARYA HEIGHTS BY DIVYANSH GROUP',
    companyName: 'Divyansh Homes Pvt Ltd',
    builder: 'Mr. Chanderjeet Pathak',
    location: 'Plot No. GH-04, Block-J, Anand Vihar Awasiya Yojana, Hapur, UP',
    propertyType: PropertyType.APARTMENT,
    startingPrice: 10810000, // 1880 sq.ft @ 5750
    endingPrice: 14173750, // 2465 sq.ft @ 5750
    possessionDate: new Date('2028-03-01'),
    reraNumber: 'UPRERAPRJ11131',
    amenities: ['Spacious Foyer Entrance', '4 High-Speed Lifts', '6 Apartments Per Floor', 'Excellent Ventilation & Natural Light', 'Covered Car Parking'],
    description: 'Aarya Heights by Divyansh Group in Anand Vihar Awasiya Yojana, Hapur spans 1.20 acres (4,850 sq.mtr) with 1 iconic tower (G+27 floors, 160 units). 3 BHK + 3T (1880, 2065 sq.ft, EOI ₹7L) and 4 BHK + 4T (2465 sq.ft, EOI ₹10L). BSP ₹5,750/sq.ft. Free PLC, Club, FFC, EEC, EDC. Car parking ₹2.50 Lakh.',
    chunks: [
      `PROJECT: AARYA HEIGHTS BY DIVYANSH GROUP
LOCATION: Plot No. GH-04, Block-J, Anand Vihar Awasiya Yojana, Hapur, Uttar Pradesh.
BUILDER: Divyansh Homes Pvt Ltd. Owner: Mr. Chanderjeet Pathak.
LAND & TOWER: 1.20 Acres (4,850 sq.mtr), 1 Tower, G+27 Floors, 160 Apartments (6 flats/floor, 4 high-speed lifts).
CONFIGURATIONS:
- 3 BHK + 3T: 1880 Sq.Ft (EOI ₹7 Lakh)
- 3 BHK + 3T: 2065 Sq.Ft (EOI ₹7 Lakh)
- 4 BHK + 4T: 2465 Sq.Ft (EOI ₹10 Lakh)
PRICE: BSP ₹5,750/Sq.Ft. Floor PLC ₹20-30 approx. Car parking ₹2.50 Lakh. Free FOC: PLC Free, Club Free, FFC Free, EEC Free, EDC Free.
PAYMENT PLAN: CLP (10% RERA, 10% rafting, 7.5% 4th floor, 7.5% construction).
BANK DETAILS: Cheque in favour of "DIVYANSH HOMES PVT LTD", Bank of Baroda, A/C: 42720200001452, IFSC: BARB0ABHAYK.`
    ]
  },

  // 3. DHOLERA CAPITAL CITY (PEGASUS BREEZEARTH 1)
  {
    name: 'DHOLERA CAPITAL CITY (PEGASUS BREEZEARTH 1)',
    companyName: 'Pegasus BreezeEarth',
    builder: 'Mihir Bhojani',
    location: 'Aakaru, Cher Road, 2 KM from SIR Boundary, Dholera, Gujarat',
    propertyType: PropertyType.PLOT,
    startingPrice: 1428000, // 168 yards @ 8500
    endingPrice: 6077500, // 715 yards @ 8500
    possessionDate: new Date('2026-06-01'),
    reraNumber: 'GJ/RERA/DHOLERA/01',
    amenities: ['Internal 12M Main Road & 9M Sub Roads', 'Front 18M Road', 'Upcoming Ring Road Connectivity', 'Near TP3 Industrial Zone'],
    description: 'Dholera Capital City (Pegasus BreezeEarth 1) on Aakaru Cher Road, 2 km from SIR boundary, Dholera Smart City, Gujarat. 19 acres (80,000 sq.m), 325 residential/investment plots from 168 to 715 yards (available 278, 298, 322 sq.yds). BSP ₹8,500/sq.yd. Development charges ₹1,500, Corner PLC ₹500. 3 months full payment plan.',
    chunks: [
      `PROJECT: DHOLERA CAPITAL CITY (PEGASUS BREEZEARTH 1)
LOCATION: Aakaru, Cher Road, 2 KM from SIR Boundary, Tehsil Dhandhuka, Dholera Smart City, Gujarat.
DEVELOPER: Pegasus BreezeEarth. Owner: Mihir Bhojani.
LAND & PLOTS: 19 Acres (80,000 sq.m), 325 Plots. Roads: 18m front road, 12m main road, 9m/7.5m internal sub roads. Future planning ring road adjacent.
NEAREST ZONE: TP3 Industrial Zone in Dholera SIR (920 sq.km smart city, 6 TP, 22 Sub-TP).
PLOT SIZES: 168 sq.yds to 715 sq.yds (popular sizes: 278, 298, 322 sq.yds).
PRICING: BSP ₹8,500/sq.yd. Development charges ₹1,500/sq.yd, Corner PLC ₹500/sq.yd, One-time maintenance ₹175/sq.yd.
PAYMENT PLAN: 3 Months full payment plan.`
    ]
  },

  // 4. VVIP PRE-LAUNCH
  {
    name: 'VVIP PRE-LAUNCH',
    companyName: 'Vibhor Vaibhav Infra Homes Pvt Ltd',
    builder: 'Praveen Tyagi, Vaibhav Tyagi & Vibhor Tyagi (VVIP Group)',
    location: 'Raj Nagar Extension, Ghaziabad, UP',
    propertyType: PropertyType.APARTMENT,
    startingPrice: 9062500, // 1250 sq.ft @ 7250
    endingPrice: 17400000, // 2400 sq.ft @ 7250
    possessionDate: new Date('2028-12-01'),
    reraNumber: 'UPRERAPRJ11132',
    amenities: ['60,000 Sq.Ft Lavish Modern Club', '3-Side Open Corner Plot', '4 High-Speed Lifts per Floor', 'Commercial Society Shops', 'Swimming Pool & Sports'],
    description: 'VVIP Pre-Launch in Raj Nagar Extension, Ghaziabad spans 5 acres with 5 towers (G+30 floors, 750 units, 5 units/floor with 4 lifts). 2 BHK (1250 sq.ft, EOI ₹5L), 3 BHK (1800 sq.ft, EOI ₹7.5L), 4 BHK (2400 sq.ft, EOI ₹10L). Residential BSP ₹7,250/sq.ft. Commercial shops: Ground ₹24,000, Middle ₹16,000, Top ₹12,000/sq.ft. Payment plan: 40% RERA, 30% top floor, 20% lift, 10% possession.',
    chunks: [
      `PROJECT: VVIP PRE-LAUNCH
LOCATION: Raj Nagar Extension, Ghaziabad, Uttar Pradesh.
BUILDER: Vibhor Vaibhav Infra Homes Pvt Ltd (VVIP Group). Owners: Praveen Tyagi, Vaibhav Tyagi, Vibhor Tyagi.
LAND & TOWERS: 5 Acres, 5 Towers, G+30 Floors, 750 Total Units (5 flats/floor, 4 lifts/floor). 3-Side Open Corner Plot.
CLUBHOUSE: 60,000 Sq.Ft lavish modern club.
CONFIGURATIONS & EOI:
- 2 BHK: 1250 Sq.Ft (EOI ₹5 Lakh)
- 3 BHK: 1800 Sq.Ft (EOI ₹7.5 Lakh)
- 4 BHK: 2400 Sq.Ft (EOI ₹10 Lakh)
PRICING: Residential BSP ₹7,250/Sq.Ft. Floor PLC ₹20/sq.ft. Other charges ₹500 tentative.
COMMERCIAL SHOPS BSP: Ground Floor ₹24,000/sq.ft, Middle Floor ₹16,000/sq.ft, Top Floor ₹12,000/sq.ft.
PAYMENT PLAN: Residential: 40% RERA, 30% Top Floor, 20% Lift, 10% Possession. Commercial: 40% RERA, 30% Top floor, 20% lift, 10% possession.
BANK DETAILS: Cheque in favour of "VIBHOR VAIBHAV INFRA HOMES PVT LTD". Loans approved from all banks.`
    ]
  },

  // 5. SAYA PRE-LAUNCH
  {
    name: 'SAYA PRE-LAUNCH',
    companyName: 'Saya Promoter LLP',
    builder: 'Vikas Bhasin (Saya Group)',
    location: 'Raj Nagar Extension, Ghaziabad, UP',
    propertyType: PropertyType.APARTMENT,
    startingPrice: 6900000, // 1000 sq.ft @ 6900
    endingPrice: 17940000, // 2600 sq.ft @ 6900
    possessionDate: new Date('2028-12-01'),
    reraNumber: 'UPRERAPRJ11133',
    amenities: ['1,50,000 Sq.Ft Mega Luxury Club', 'Grand Landscaped Central Green', 'Swimming Pool & Health Club', 'High-Speed Lifts', 'Covered Parking'],
    description: 'Saya Pre-Launch in Raj Nagar Extension, Ghaziabad spans 18 acres with 17-18 towers (G+22-25 floors, 2200 units, 4-6 units/floor). Massive 1,50,000 sq.ft luxury clubhouse. Configurations: 2 BHK (1000 sq.ft), 2+S BHK (1200 sq.ft), 3 BHK (1400, 1600, 1800 sq.ft), 4 BHK (2600 sq.ft). BSP ₹6,900/sq.ft. 20*5 payment plan (20% RERA, 20% rafting, 20% 10th floor, 20% superstructure, 20% possession).',
    chunks: [
      `PROJECT: SAYA PRE-LAUNCH
LOCATION: Raj Nagar Extension, Ghaziabad, Uttar Pradesh.
BUILDER: Saya Promoter LLP. Owner: Vikas Bhasin.
LAND & TOWERS: 18 Acres, 17-18 Towers, G+22-25 Floors, 2200 Units (4-6 flats/floor, 2-3 lifts/floor).
CLUBHOUSE: 1,50,000 Sq.Ft lavish modern mega clubhouse (largest in region).
CONFIGURATIONS:
- 2 BHK: 1000 Sq.Ft (EOI ₹8 Lakh)
- 2+S BHK: 1200 Sq.Ft
- 3 BHK: 1400 & 1600 Sq.Ft (EOI ₹10 Lakh)
- 3 BHK: 1800 Sq.Ft
- 4 BHK: 2600 Sq.Ft (EOI ₹15 Lakh)
PRICING: Residential BSP ₹6,900/Sq.Ft. Floor PLC ₹20-30/sq.ft. Other charges ₹500 tentative.
PAYMENT PLAN (20*5): 20% on RERA approval, 20% on rafting, 20% on 10th floor, 20% on superstructure, 20% on offer of possession.
BANK DETAILS: Cheque in favour of "SAYA PROMOTER LLP".`
    ]
  },

  // 6. COSMOS CORNER BY AU REAL ESTATE
  {
    name: 'COSMOS CORNER BY AU REAL ESTATE',
    companyName: 'Cosmos REIT Pvt Ltd (AU Real Estate)',
    builder: 'Mr. Ashish & Uma',
    location: 'Plot No. 7B/GH-01, Siddharth Vihar Yojna, Delhi-Meerut Expressway, Ghaziabad',
    propertyType: PropertyType.APARTMENT,
    startingPrice: 15998200, // 1780 sq.ft @ 8989
    endingPrice: 28540075, // 3175 sq.ft @ 8989
    possessionDate: new Date('2028-05-01'),
    reraNumber: 'UPRERAPRJ466336/05/2026',
    amenities: ['Luxury G+2 Clubhouse with Double-Height Lobby', '11 Ft Ceiling Height', 'Modular Kitchen + Wardrobes Included', '1.5 Ton Split ACs in 5BHK', '7 High-Speed Lifts per Floor'],
    description: 'Cosmos Corner by AU Real Estate in Siddharth Vihar Yojna on Delhi-Meerut Expressway, Ghaziabad spans 5.58 acres (22,582 sq.m) with 3 iconic towers (G+40 floors, 831 units). Ceiling height 11 ft, double-height lobby, modular kitchen & wardrobes included. 3 BHK + 3T (1780 sq.ft), 3+1 BHK (1972, 1981 sq.ft), 5+1 BHK + Servant (3175 sq.ft). BSP ₹8,989/sq.ft (All-inclusive ₹11,089/sq.ft). Construction Link Payment Plan (CLP).',
    chunks: [
      `PROJECT: COSMOS CORNER BY AU REAL ESTATE
LOCATION: Plot No. 7B/GH-01, Siddharth Vihar Yojna, Delhi-Meerut Expressway, Ghaziabad, UP. RERA: UPRERAPRJ466336/05/2026.
BUILDER: AU Real Estate / Cosmos REIT Pvt Ltd. Owners: Mr. Ashish, Uma.
LAND & TOWERS: 5.58 Acres (22,582 sq.m), 3 Towers, G+40 Floors, 831 Units (7 units/floor, 7 high-speed lifts). 2-Side Open Plot.
FEATURES: 11 Ft Ceiling Height, G+2 Luxury Clubhouse, Double-height entrance lobby, Modular kitchen + 2 wardrobes in 3BHK, 4 wardrobes + 1.5 ton split ACs in all bedrooms in 5BHK.
CONFIGURATIONS:
- 3 BHK + 3T: 1780 Sq.Ft
- 3+1 BHK + 3T + 1 ST: 1972 & 1981 Sq.Ft
- 5+1 BHK + 4T + 1 ST: 3175 Sq.Ft
PRICING: BSP ₹8,989/Sq.Ft (All-Inclusive ₹11,089/Sq.Ft). Other charges ₹1,661/sq.ft (Floor PLC, Location PLC, Parking, Club, ED, IDC, FFC). GST 5%.
PAYMENT PLAN (CLP): 10% on booking, 30% within 60 days, 20% on 20th floor, 20% on top floor, 15% ext paint, 5% on possession.
BANK DETAILS: Cheque in favour of "COSMOS REIT PRIVATE LIMITED COLLECTION AC", Axis Bank, A/C: 926020014501871, IFSC: UTIB0000636.`
    ]
  },

  // 7. PALACE HEIGHTS BY RUDRA
  {
    name: 'PALACE HEIGHTS BY RUDRA',
    companyName: 'Rudra Buildwell',
    builder: 'Mukesh Khurana (Rudra Buildwell)',
    location: 'GH-02B, Sector 1, Noida Extension, Greater Noida West',
    propertyType: PropertyType.APARTMENT,
    startingPrice: 6090000,
    endingPrice: 19879500,
    possessionDate: new Date('2027-05-01'),
    reraNumber: 'UPRERAPRJ11124',
    amenities: ['30,000 Sq.Ft Clubhouse', '70% Green Area', '2-Side Open Plot', '22 Society Shops', 'Fully Furnished 1 BHK', 'Power Backup & Security', 'Dedicated Parking'],
    description: 'Palace Heights by Rudra in GH-02B, Sector 1, Greater Noida West spans 8.27 acres with 10 towers (G+22 floors, 1434 units, 70% green area, 30,000 sq.ft clubhouse). Configurations: 1 BHK (700 sq.ft fully furnished), 2 BHK (1015, 1088 sq.ft), 3 BHK (1341, 1405, 1540, 1568 sq.ft), 4 BHK (1841, 2285 sq.ft). BSP ₹8,700/sq.ft. 50:50 payment plan. 3 towers ready for possession in 6 months.',
    chunks: [
      `PROJECT: PALACE HEIGHTS BY RUDRA
LOCATION: GH-02B, Sector 1, Noida Extension, Greater Noida West.
BUILDER: Rudra Buildwell. Owner: Mukesh Khurana.
LAND & TOWERS: 8.27 Acres, 10 Towers, G+22 Floors, 1434 Units. 70% Green area, 2-Side Open Plot, 30,000 sq.ft clubhouse, 22 society shops.
POSSESSION: 3 Towers ready in 6 months (B1, B2, B6).
CONFIGURATIONS: 1 BHK 700 sq.ft (fully furnished) | 2 BHK 1015, 1088 sq.ft | 3 BHK 1341, 1405, 1540, 1568 sq.ft | 4 BHK 1841, 2285 sq.ft.
PRICING: BSP ₹8,700/Sq.Ft. Car parking ₹4L, Club ₹2L, Power backup ₹25k/KVA, EEC/FFC ₹40, IFMS ₹40, Floor PLC ₹30, Road/Park PLC ₹200, Lease rent ₹45.
PAYMENT PLAN: 50 Now 50 on Offer of Possession (50:50).
BANK DETAILS: Cheque in favour of "RBPPL COLLECTION ACCOUNT FOR RUDRA PALACEHEIGHTS", HDFC Bank Sec-63 Noida, A/C: 57500000114328, IFSC: HDFC0000394.`
    ]
  },

  // 8. NCR MONARCH
  {
    name: 'NCR MONARCH',
    companyName: 'JSS Buildcon Pvt Ltd',
    builder: 'Ankit Sharma & PK Sharma (JSS Buildcon)',
    location: 'GH-02C, Sector 1, Noida Extension, Greater Noida West',
    propertyType: PropertyType.APARTMENT,
    startingPrice: 6399360,
    endingPrice: 16087280,
    possessionDate: new Date('2027-12-01'),
    reraNumber: 'UPRERAPRJ11125',
    amenities: ['30,000 Sq.Ft Clubhouse', '70% Green Area', '25 Society Commercial Shops', 'Banquet Hall', 'Swimming Pool & Gym', 'Covered Parking'],
    description: 'NCR Monarch in GH-02C, Sector 1, Greater Noida West spans 3.75 acres across 4 towers with 671 units. 1 BHK (720-1010 sq.ft in T4), 2 BHK + 2T (1075, 1255 sq.ft), 3 BHK (1345, 1400, 1595, 1810 sq.ft), plus G+2 commercial shops and banquet hall. BSP ₹8,888/sq.ft.',
    chunks: [
      `PROJECT: NCR MONARCH
LOCATION: GH-02C, Sector 1, Noida Extension, Greater Noida West.
BUILDER: JSS Buildcon Pvt Ltd. Owners: Ankit Sharma & PK Sharma.
LAND & TOWERS: 3.75 Acres, 4 Towers (T1: G+24, T2: G+25, T3: G+25, T4: G+13), 671 Units, 70% Green area, 30,000 sq.ft clubhouse.
COMMERCIAL: 25 Society shops (sold out), T4 G+2 Commercial (120-2500 sq.ft) & Banquet hall.
CONFIGURATIONS: 1 BHK 720, 905, 925, 1010 sq.ft | 2 BHK 1075, 1255 sq.ft | 3 BHK 1345, 1400, 1595, 1810 sq.ft.
PRICING: BSP ₹8,888/Sq.Ft. Car parking ₹4.95L, Club ₹3L, PLC ₹125, Water conn ₹25k, Power backup ₹25k/KVA, IFMS ₹35, Lease rent ₹85.
PAYMENT PLANS: T2: 50 Now 50 on Possession (50:50) | T1, T3, T4: Downpayment within 30 days (No GST).
BANK DETAILS: Cheque in favour of "JSS BUILDCON PVT LTD - COLLECTION ACCOUNT FOR NCR MONARCH", ICICI Bank Nariman Point Mumbai, A/C: 000405136921, IFSC: ICIC0000004.`
    ]
  },

  // 9. BIIGTECH
  {
    name: 'BIIGTECH IT PARK',
    companyName: 'Prasandi Infotech Park Pvt Ltd',
    builder: 'Arjunpreet Singh Sahni',
    location: 'Plot No. 21, Knowledge Park-III, Greater Noida, UP 201308',
    propertyType: PropertyType.COMMERCIAL,
    startingPrice: 2771900, // Studio 226 sq.ft @ 12250
    endingPrice: 87852000, // Office 2196 sq.ft @ 40000
    possessionDate: new Date('2026-08-01'),
    reraNumber: 'UPRERAPRJ656513/08/2025',
    amenities: ['Multiplex & 4-Screen Cinema', 'Gaming Zone & Co-Working', 'Food Court & Fine Dining', 'Corporate Suites & Studio Apartments', 'High-Speed Elevators'],
    description: 'Biigtech IT Park in Knowledge Park-III, Greater Noida spans 17.5 acres across 6 towers (Tower ABCD delivered 10 acres, Tower E G+4 & F G+17 combined 7.5 acres). Offers Retail, Food Court, Multiplex, Gaming Zone, Co-working, Grade-A Offices, and Corporate Studio Suites. LGF Retail ₹24,250, UGF Retail ₹32,250, Food Court ₹14,250, Offices ₹40,000, Studios ₹12,250/sq.ft. Payment plan 75:25 or CLP.',
    chunks: [
      `PROJECT: BIIGTECH IT PARK
LOCATION: Plot No. 21, Knowledge Park-III, Greater Noida, Gautam Buddha Nagar, UP 201308. RERA: UPRERAPRJ656513/08/2025.
PROMOTER: Prasandi Infotech Park Pvt Ltd. Owner: Arjunpreet Singh Sahni.
LAND & TOWERS: 17.5 Acres, 6 Towers. Tower ABCD delivered (10 acres). Tower E (G+4: Retail, Food Court, Multiplex) & Tower F (G+17: Retail, Food court, Gaming/Coworking, Offices 5-13th, Studios 15-17th) on 7.5 acres.
SIZES & PRICING:
- LGF Retail: ₹24,250/sq.ft (LG ₹129)
- UGF Retail: ₹32,250/sq.ft (LG ₹201)
- 1st Retail: ₹18,750/sq.ft
- 2nd Food Court: ₹14,250/sq.ft | Restaurant: ₹16,250/sq.ft
- 3rd/4th Multiplex: ₹9,250/sq.ft | Gaming Zone: ₹10,250/sq.ft | Coworking: ₹10,250/sq.ft
- 5th to 13th Office Spaces: ₹40,000/sq.ft
- 15th to 17th Corporate Studios: ₹12,250/sq.ft
PAYMENT PLANS: Offer: 75% at booking, 25% on possession | Office offer: 60% booking, 20% superstructure, 20% possession | Construction Link Plan.
BANK DETAILS: Cheque in favour of "PRASANDI INFOTECH PARK PRIVATE LIMITED", ICICI Bank Gamma Greater Noida, A/C: 777705348807, IFSC: ICIC0003488.`
    ]
  },

  // 10. SVG TOWN SQUARE-1
  {
    name: 'SVG TOWN SQUARE-1',
    companyName: 'Mahavinayaka Infraproject Pvt Ltd',
    builder: 'Vikas Bhasin',
    location: 'Plot No. SLC-3/4, Sector Alpha-2, Greater Noida, UP',
    propertyType: PropertyType.COMMERCIAL,
    startingPrice: 5775000, // 165 sq.ft @ 35000
    endingPrice: 172150000, // 3443 sq.ft @ 50000
    possessionDate: new Date('2026-04-01'),
    reraNumber: 'UPRERAPRJ230755/04/2025',
    amenities: ['627 Society Retail Shops', 'Food Court & Fine Dining', 'Studio Apartments (Floors 8-18)', 'Power Backup & Central AC', 'High Footfall Alpha-2 Commercial Hub'],
    description: 'SVG Town Square-1 on Plot SLC-3/4, Sector Alpha-2, Greater Noida spans 0.63 acre (2,580 sq.m) with 1 commercial tower (5 floors G+3 commercial shops + 8th-18th floors studio units). 627 shops, sizes 165 to 3443 sq.ft. LGF ₹40,000, UGF Retail ₹45,000, UGF Food Court ₹50,000, 1st/2nd ₹35,000/sq.ft. Payment plan: 10% booking, 90% within 30 days.',
    chunks: [
      `PROJECT: SVG TOWN SQUARE-1
LOCATION: Commercial Builder Plot No. SLC-3/4, Sector Alpha-2, Greater Noida. RERA: UPRERAPRJ230755/04/2025.
PROMOTER: Mahavinayaka Infraproject Pvt Ltd. Owner: Vikas Bhasin.
LAND & BUILDING: 0.63 Acre (2,580 sq.m), 1 Tower, 5 Floors (LG, UG, 1, 2, 3) + 8th to 18th Floor Studio Units (131 units). Total 627 Shops (165 to 3443 sq.ft).
RATES: LGF ₹40,000/sq.ft, UGF Retail ₹45,000/sq.ft, UGF Food Court ₹50,000/sq.ft, 1st & 2nd Retail ₹35,000/sq.ft, 3rd Restaurant ₹40,000/sq.ft.
OTHER CHARGES: Lease rent FOC, EEC/FFC FOC, IFMS ₹100/sq.ft. PLC: 10% road facing, 5% atrium facing, 5% corner.
PAYMENT PLAN: 10% at booking, 90% within 30 days.
BANK DETAILS: Cheque in favour of "RGBIL COLLECTION A/C FOR SAYA PIAZZA", HDFC Bank Indirapuram, A/C: 99991000000704, IFSC: HDFC0000590.`
    ]
  },

  // 11. SAYA PIAZZA
  {
    name: 'SAYA PIAZZA',
    companyName: 'Saya Group (RGBIL)',
    builder: 'Vikas Bhasin',
    location: 'C-1 & C-2, Sector 131, Noida Expressway, inside Jaypee Wish Town',
    propertyType: PropertyType.COMMERCIAL,
    startingPrice: 4867500, // 165 sq.ft @ 29500
    endingPrice: 172150000, // 3443 sq.ft @ 50000
    possessionDate: new Date('2026-06-01'),
    reraNumber: 'UPRERAPRJ364061',
    amenities: ['627 Premium Commercial Shops', 'Food Court & Fine Dining', 'Opposite Jaypee Wish Town Gated Community', 'Multi-Level Parking', 'High Footfall Catchment'],
    description: 'Saya Piazza in Sector 131, Noida Expressway (inside Jaypee Wish Town) spans 1.72 acres with 1 commercial tower (5 floors, 627 shops, sizes 165 to 3443 sq.ft). Lower GF ₹29,500, Upper GF Retail ₹40,000, Food Court ₹50,000, 1st Retail ₹30,000, 2nd Retail ₹29,000, 3rd Retail ₹31,500/sq.ft. Lease rent & EEC/FFC free of cost. Payment plan: 10% booking, 90% within 30 days.',
    chunks: [
      `PROJECT: SAYA PIAZZA
LOCATION: C-1 & C-2, Sector 131, Noida Expressway, inside Jaypee Wish Town. RERA: UPRERAPRJ364061.
PROMOTER: Saya Group. Owner: Vikas Bhasin.
LAND & BUILDING: 1.72 Acres, 1 Tower, 5 Floors (LG, UG, 1, 2, 3), 627 Shops (165 to 3443 sq.ft).
RATES: Lower GF ₹29,500/sq.ft, Upper GF Retail ₹40,000/sq.ft, Upper GF Food Court ₹50,000/sq.ft, 1st Floor ₹30,000/sq.ft, 2nd Floor ₹29,000/sq.ft, 3rd Retail ₹31,500/sq.ft, 3rd Restaurant ₹40,000/sq.ft.
OTHER CHARGES: Lease rent FOC, EEC/FFC FOC, IFMS ₹100/sq.ft. PLC: 10% road facing, 5% atrium facing, 5% corner facing.
PAYMENT PLAN: 10% at booking, 90% within 30 days.
BANK DETAILS: Cheque in favour of "RGBIL COLLECTION A/C FOR SAYA PIAZZA", HDFC Bank Indirapuram, A/C: 99991000000704, IFSC: HDFC0000590.`
    ]
  },

  // 12. AUTOGRAPH LUXURY RESIDENCES
  {
    name: 'AUTOGRAPH LUXURY RESIDENCES',
    companyName: 'Autograph Group',
    builder: 'Ankit Sharma & Ankit Mathur',
    location: 'Plot No. GH-01-C, Sector 16, Noida Extension, Greater Noida West, UP 201318',
    propertyType: PropertyType.APARTMENT,
    startingPrice: 21262500, // 2025 sq.ft @ 10500
    endingPrice: 30345000, // 2890 sq.ft @ 10500
    possessionDate: new Date('2028-06-01'),
    reraNumber: 'UPRERAPRJ7360',
    amenities: ['Jacuzzi on Balcony in 2890 Sq.Ft Units', 'Separate Foyer with Study', 'Double Height Lobby', 'Ultra-Luxury Clubhouse & Pool', 'Panoramic Balconies'],
    description: 'Autograph Luxury Residences in Sector 16, Greater Noida West spans 4.27 acres with 3 towers + 1 Phase II (Tower A S+34, Tower B1 S+36, Tower B2 S+36). Ultra-luxury 3 BHK + 3T (2025 sq.ft), 4 BHK + 4T (2525 sq.ft), 4 BHK + 4T + Study (2890 sq.ft with private jacuzzi on balcony). BSP ₹10,500/sq.ft. Payment plans: 20x5, 25x4, 30:40:30, CLP.',
    chunks: [
      `PROJECT: AUTOGRAPH LUXURY RESIDENCES
LOCATION: Plot No. GH-01-C, Sector 16, Noida Extension, Greater Noida West, UP 201318. RERA: UPRERAPRJ7360.
BUILDER: Owners: Ankit Sharma, Ankit Mathur.
LAND & TOWERS: 4.27 Acres, 3 Towers + 1 Phase II. Tower A (S+34), Tower B1 (S+36), Tower B2 (S+36).
CONFIGURATIONS:
- 3 BHK + 3T + Foyer + 6 Balconies: 2025 Sq.Ft (Tower B2)
- 4 BHK + 4T + Foyer + 6 Balconies: 2525 Sq.Ft (Tower B1)
- 4 BHK + 4T + Study + Foyer + 8 Balconies: 2890 Sq.Ft with provision of Jacuzzi on balcony (Tower A)
PRICE: BSP ₹10,500/Sq.Ft.
PAYMENT PLANS: 20x5 | 25x4 | 30:40:30 | CLP.
VICINITY: Vaibhav Heritage Height, SKA Divya Towers, Panchsheel Greens 2, Gulshan Bellina, Nirala Aspire, Casa Greens, Saya South X, London Mart, Gaur City.`
    ]
  },

  // 13. CROWN RESIDENCES AT GODREJ GOLF LINKS
  {
    name: 'CROWN RESIDENCES AT GODREJ GOLF LINKS',
    companyName: 'Godrej Properties / AR Landcraft LLP',
    builder: 'Pirojsha Godrej',
    location: 'Plot No. REP-01, Sector-27, Greater Noida, UP',
    propertyType: PropertyType.APARTMENT,
    startingPrice: 28800000, // 3 BHK 1769 sq.ft
    endingPrice: 49900000, // 3 BHK 2392 sq.ft
    possessionDate: new Date('2027-02-15'),
    reraNumber: 'UPRERAPRJ438937/04/2026',
    amenities: ['100-Acre Golf Links Township', 'Exclusive 9-Hole Golf Course', 'Olympic Size Pool & Clubhouse', 'Panoramic Golf Views', '4 Flats per Floor with High-Speed Lifts'],
    description: 'Crown Residences at Godrej Golf Links in Sector-27, Greater Noida spans 4.48 acres within a 100-acre golf township. 3 towers (G+25, 300 flats, 4 flats/floor). 3 BHK Golf Residences (1769 sq.ft, ₹2.88 Cr - ₹3.44 Cr, EOI ₹7.5L), 3 BHK Large Golf Residences (2392 sq.ft, ₹4.23 Cr - ₹4.99 Cr, EOI ₹10L), 4 BHK + Servant + Study (3300 sq.ft). Payment plan 30:40:30.',
    chunks: [
      `PROJECT: CROWN RESIDENCES AT GODREJ GOLF LINKS
LOCATION: Plot No. REP-01, Sector-27, Greater Noida, UP. RERA: UPRERAPRJ438937/04/2026.
BUILDER: Godrej Properties / AR Landcraft LLP. Owner: Pirojsha Godrej.
LAND & TOWERS: 4.48 Acres in 100-Acre Golf Township, 3 Towers (G+25), 300 Total Flats (4 flats/floor on Tower A1, A2, A3).
CONFIGURATIONS & PRICING (Tower A2):
- 3 BHK Golf Residences: 1769 Sq.Ft (₹2.88 Cr to ₹3.44 Cr, EOI ₹7.5 Lac)
- 3 BHK Large Golf Residences: 2392 Sq.Ft (₹4.23 Cr to ₹4.99 Cr, EOI ₹10 Lac)
- 4 BHK + Servant + Study: 3300 Sq.Ft
PAYMENT PLAN (30:40:30): 5% application, 5% in 18 days, 10% in 120 days, 10% by 15 Feb 2027, 20% on 5th floor slab, 20% on terrace slab, 10% on flooring, 15% on OC, 5% on possession.
BANK DETAILS: Cheque in favour of "AR LANDCRAFT LLP COLLECTION ACCOUNT FOR CROWN RESIDENCES AT GODREJ GOLF LINKS", ICICI Bank Sec-18 Noida, A/C: 777705754509, IFSC: ICIC0000031.`
    ]
  },

  // 14. VVIP NAMAH BY VVIP EMS INFRAHOME
  {
    name: 'VVIP NAMAH BY VVIP EMS INFRAHOME',
    companyName: 'VVIP EMS Infrahome',
    builder: 'Vaibhav Tyagi, Vibhor Tyagi & Praveen Tyagi',
    location: 'Aditya World City, NH-24, Shahpur Bamheta, Ghaziabad, UP 201003',
    propertyType: PropertyType.APARTMENT,
    startingPrice: 16415400, // 1635 sq.ft @ 10040
    endingPrice: 32726700, // 3105 sq.ft @ 10540
    possessionDate: new Date('2028-06-01'),
    reraNumber: 'UPRERAPRJ576907',
    amenities: ['Swimming Pool & Kids Pool', 'Clubhouse with Gym & Spa', 'Aditya World City Gated Township', 'Private Balconies with 270 Degree Views', 'Covered Parking'],
    description: 'VVIP Namah by VVIP EMS Infrahome in Aditya World City, NH-24, Ghaziabad spans 2.75 acres with 3 towers (G+23 Trance). Configurations: 3 BHK (1635, 1650, 1970, 1980 sq.ft) & 4 BHK + Servant (3105 sq.ft). Pre-launch Tower D: 3 BHK (2320 sq.ft, EOI ₹20L) & 4 BHK (2950 sq.ft, EOI ₹25L). BSP 3 BHK ₹10,040, 4 BHK ₹10,540 (Tower D pre-launch 3BHK ₹8,440, 4BHK ₹8,840). Exclusive launch benefit up to ₹3 Lakh.',
    chunks: [
      `PROJECT: VVIP NAMAH BY VVIP EMS INFRAHOME
LOCATION: Aditya World City, NH-24, Shahpur Bamheta, Ghaziabad, UP 201003. RERA: UPRERAPRJ576907.
BUILDER: VVIP EMS Infrahome. Owners: Vaibhav Tyagi, Vibhor Tyagi, Praveen Tyagi.
LAND & TOWERS: 2.75 Acres, 3 Towers, G+23 Floors.
CONFIGURATIONS:
- Tower A: 4 BHK + Servant + 5T + 6 Balconies: 3105 Sq.Ft (2 flats/floor)
- Tower B: 3 BHK (1635, 1980 Sq.Ft)
- Tower C: 3 BHK (1650, 1970, 1985 Sq.Ft)
- Tower D (Pre-Launch): 3 BHK 2320 Sq.Ft (EOI ₹20L) | 4 BHK 2950 Sq.Ft (EOI ₹25L)
PRICING: BSP 3 BHK ₹10,040/sq.ft, 4 BHK ₹10,540/sq.ft (Tower D pre-launch: 3 BHK ₹8,440, 4 BHK ₹8,840). Car parking ₹5L, Club ₹3L, Power backup ₹35k/KVA.
PAYMENT PLANS: 25% RERA, 25% in 30 days, 25% top floor, 25% possession | CLP (5% every 2nd floor).
BANK DETAILS: Cheque in favour of "VVIP EMS INFRAHOMES", ICICI Bank Raj Nagar Ghaziabad, A/C: 628605017759, IFSC: ICIC0000031.`
    ]
  },

  // 15. SAYA SOUTH X
  {
    name: 'SAYA SOUTH X',
    companyName: 'Saya Group',
    builder: 'Vikas Bhasin',
    location: 'Plot No. C-01 12, near Ek Murti Chowk, Sector Ecotech-1, Roza Yakubpur, Greater Noida West 201306',
    propertyType: PropertyType.COMMERCIAL,
    startingPrice: 3960000, // Studio 330 sq.ft @ 12000
    endingPrice: 150000000,
    possessionDate: new Date('2026-10-01'),
    reraNumber: 'UPRERAPRJ17950',
    amenities: ['762 Commercial Retail Shops', '6-Screen Multiplex & 14 Restaurants', 'Food Court & Entertainment Zone', 'Studio Apartments (Floors 7-25)', 'Near Ek Murti Chowk High Footfall Location'],
    description: 'Saya South X near Ek Murti Chowk, Greater Noida West spans 3 acres with 1 commercial tower (25 floors, 762 shops, 6-screen multiplex, food court, studio apartments on 7th-25th floor). LG Retail ₹26,000, UG Retail ₹36,000, 1st Retail ₹25,000, Food Court ₹25,000, Studio Apartments ₹12,000/sq.ft. 50:50 payment plan (50% within 30 days, 50% on possession).',
    chunks: [
      `PROJECT: SAYA SOUTH X
LOCATION: Plot No. C-01 12, near Ek Murti Chowk, Sector Ecotech-1, Roza Yakubpur, Greater Noida West, UP 201306. RERA: UPRERAPRJ17950.
BUILDER: Saya Group. Owner: Vikas Bhasin.
LAND & BUILDING: 3 Acres, 1 Tower, 25 Floors, 762 Shops. LG: 206 shops + 25 kiosks, Ground: 162 shops, 1st: 166 shops, 2nd: 166 shops, 3rd: 100 food spaces, 4th/5th: 6-screen multiplex + 14 restaurants + banquet, 7th-25th: Studio apartments.
PRICING: LG Retail ₹26,000/sq.ft, UG Retail ₹36,000/sq.ft, 1st Retail ₹25,000/sq.ft, 2nd Retail ₹23,000/sq.ft, 3rd Food Court ₹25,000/sq.ft, Studio Apartments ₹12,000/sq.ft. Lease rent & EEC/FFC FOC.
PAYMENT PLAN: 50:50 (50% within 30 days of booking, 50% on offer of possession).
BANK DETAILS: Cheque in favour of "FILL COLLECTION A/C FOR SAYA SOUTH X", HDFC Bank Indirapuram, A/C: 99991000000701, IFSC: HDFC0000590.`
    ]
  },

  // 16. DIVYANSH ONYX
  {
    name: 'DIVYANSH ONYX',
    companyName: 'Divyansh Homes Pvt Ltd',
    builder: 'Mr. Chanderjeet Pathak',
    location: 'Aditya World City, H-Block, Jaipuria Township, NH-24, Ghaziabad, UP',
    propertyType: PropertyType.APARTMENT,
    startingPrice: 8740550, // 1190 sq.ft @ 7345
    endingPrice: 18977850, // 2330 sq.ft @ 8145
    possessionDate: new Date('2027-06-01'),
    reraNumber: 'Phase-I: UPRERAPRJ15690 | Phase-II: UPRERAPRJ101801',
    amenities: ['20,000 Sq.Ft Luxury Clubhouse', 'Swimming Pool & Kids Pool', 'Jogging Track & Yoga Lawn', 'Aditya World City Integrated Township', 'Gated Security'],
    description: 'Divyansh Onyx in Aditya World City, Jaipuria Township, NH-24, Ghaziabad spans 4 acres across 4 towers (605 total flats, 20,000 sq.ft clubhouse). Configurations: 2 BHK + 2T (1080, 1190, 1375 sq.ft), 3 BHK + 2T (1375, 1485, 1490, 1535 sq.ft), 4 BHK + 4T (2325, 2330 sq.ft). BSP ₹7,345 to ₹8,145/sq.ft. Payment plan: 10% booking, 80% within 60 days, 10% on possession.',
    chunks: [
      `PROJECT: DIVYANSH ONYX BY DIVYANSH HOMES PVT LTD
LOCATION: Aditya World City, H-Block, Jaipuria Township, NH-24, Ghaziabad, UP. RERA Phase-I: UPRERAPRJ15690, Phase-II: UPRERAPRJ101801.
BUILDER: Divyansh Homes Pvt Ltd. Owner: Mr. Chanderjeet Pathak.
LAND & TOWERS: 4 Acres, 4 Towers (D1: 23 floors/115 flats, D2: 23 floors/138 flats, D3: 22 floors/176 flats, D4: 22 floors/176 flats). Grand Total: 605 Flats, 20,000 sq.ft clubhouse.
CONFIGURATIONS & PRICING:
- 2 BHK + 2T: 1080, 1190, 1375 Sq.Ft (BSP ₹7,345 - ₹7,645/sq.ft)
- 3 BHK + 2T: 1375, 1485, 1490, 1535 Sq.Ft (BSP ₹7,545 - ₹7,845/sq.ft)
- 4 BHK + 4T: 2325, 2330 Sq.Ft (BSP ₹7,845 - ₹8,145/sq.ft)
OTHER CHARGES: Car parking ₹1.80L, Club ₹1.50L, Road/Pool PLC ₹100/sq.ft, FFC/EEC/EDC ₹180/sq.ft, IFMS ₹25/sq.ft.
PAYMENT PLAN: 10% booking, 80% within 60 days, 10% on possession.
BANK DETAILS: Cheque in favour of "DIVYANSH HOMES PVT. LTD. ESCROW ACCOUNT", ICICI Bank Indirapuram, A/C: 777705550840, IFSC: ICIC0007972.`
    ]
  },

  // 17. SOBHA RIVANA
  {
    name: 'SOBHA RIVANA',
    companyName: 'Sobha Limited',
    builder: 'P.N.C. Menon (Sobha Ltd)',
    location: 'Sector 1, Greater Noida, Uttar Pradesh',
    propertyType: PropertyType.APARTMENT,
    startingPrice: 20400000, // 1373 sq.ft @ 2.04 Cr
    endingPrice: 40400000, // 2715 sq.ft @ 4.04 Cr
    possessionDate: new Date('2028-12-01'),
    reraNumber: 'UPRERAPRJ11134',
    amenities: ['35,000 Sq.Ft 3-Floor Clubhouse', '350M Natural Flowing Stream (Rivulet)', '80% Open Space (9.4 Acres)', 'IGBC Pre-Certified Gold Star', 'No Common Walls Between Flats', 'Double-Glazed Soundproof Glass Facades'],
    description: 'Sobha Rivana in Sector 1, Greater Noida spans 11.76 acres with 8 towers (T1: G+43, T2-T8: G+44, 3 basements, 1,364 residences). Over 80% open space, 350m flowing stream, 35,000 sq.ft clubhouse. 2 Bed (1373 sq.ft ₹2.04 Cr, 1653 sq.ft ₹2.46 Cr), 3 Bed Luxe (1752-1796 sq.ft ₹2.61-₹2.67 Cr), 3 Bed Grande (1982 sq.ft ₹2.95 Cr), 4 Bed Luxe (2425 sq.ft ₹3.61 Cr), 4 Bed Grande (2715 sq.ft ₹4.04 Cr).',
    chunks: [
      `PROJECT: SOBHA RIVANA
LOCATION: Sector 1, Greater Noida, Uttar Pradesh.
DEVELOPER: Sobha Limited. Owner: P.N.C. Menon.
LAND & TOWERS: 11.76 Acres (47,604 sq.m), 8 Towers (Tower 1: 3B+G+43, Towers 2-8: 3B+G+44), 1,364 Luxury Residences (4 flats/floor, 4 high-speed lifts).
USPs: 80% open space (9.4 acres), 350m flowing stream (rivulet), IGBC Gold Star rating, No common walls, Double-glazed noise reduction glass facades, 3-floor 35,000 sq.ft clubhouse (badminton, squash, salon, steam/sauna, co-working).
CONFIGURATIONS & ALL-INCLUSIVE PRICES:
- 2 Bed Residence: 1373 Sq.Ft — ₹2.04 Cr
- 2 Bed Residence Grande: 1653 Sq.Ft — ₹2.46 Cr
- 3 Bed Residence Luxe: 1752-1764 Sq.Ft — ₹2.61 Cr
- 3 Bed Luxe + Terrace: 1796 Sq.Ft — ₹2.67 Cr
- 3 Bed Residence Grande: 1982 Sq.Ft — ₹2.95 Cr
- 4 Bed Residence Luxe: 2422-2425 Sq.Ft — ₹3.61 Cr
- 4 Bed Residence Grande: 2714-2715 Sq.Ft — ₹4.04 Cr
BANK DETAILS: Cheque in favour of "SOBHA LIMITED COLLECTION ACCOUNT FOR SOBHA RIVANA", Federal Bank Noida, A/C: 13400200036447, IFSC: FDRL0001340.`
    ]
  },

  // 18. HUMMINGBIRD BY GULSHAN
  {
    name: 'HUMMINGBIRD BY GULSHAN',
    companyName: 'Gulshan Group / Black Opal Ventures LLP',
    builder: 'Gulshan Nagpal & Deepak Kapoor',
    location: 'Plot No. A/GH-3, Madhuban Bapudham, Ghaziabad, UP',
    propertyType: PropertyType.APARTMENT,
    startingPrice: 10500000, // 1500 sq.ft @ 7000
    endingPrice: 15400000, // 2200 sq.ft @ 7000
    possessionDate: new Date('2028-10-01'),
    reraNumber: 'UPRERAPRJ397361/10/2026',
    amenities: ['Luxury Gated High-Rise Community', '34 High-Street Commercial Shops', 'Swimming Pool & Fitness Centre', 'Working Pods in Apartments', 'Near Duhai RRTS Rapid Rail Station'],
    description: 'Hummingbird by Gulshan in Madhuban Bapudham, Ghaziabad spans 2.20 acres with 3 towers (G+31 floors, 380 units: 346 residential, 34 commercial). 3 BHK + 2T (1500-1600 sq.ft), 3 BHK + 3T + Working Pod (1700-1800 sq.ft), 3 BHK + 3T + Study (2100-2200 sq.ft). BSP ₹7,000/sq.ft for initial 75 bookings. EOI ₹10 Lakhs. CLP payment plan.',
    chunks: [
      `PROJECT: HUMMINGBIRD BY GULSHAN
LOCATION: Plot No. A/GH-3, Madhuban Bapudham, Ghaziabad, UP. RERA: UPRERAPRJ397361/10/2026.
BUILDER: Gulshan Group / Black Opal Ventures LLP. Founders: Gulshan Nagpal, Deepak Kapoor.
LAND & TOWERS: 2.20 Acres, 3 Towers, G+31 Floors, 380 Total Units (346 flats, 34 commercial shops).
CONFIGURATIONS:
- 3 BHK + 2T: 1500 - 1600 Sq.Ft
- 3 BHK + 3T + Working Pod: 1700 - 1800 Sq.Ft
- 3 BHK + 3T + Study: 2100 - 2200 Sq.Ft
PRICING: BSP ₹7,000/Sq.Ft (for initial 75 bookings). EOI ₹10 Lakhs non-bankable cheque.
PAYMENT PLAN: Construction Linked Plan (CLP).
BANK DETAILS: Cheque in favour of "BLACK OPAL VENTURES LLP COLLECTION ACCOUNT FOR HUMMING BIRD", HDFC Bank Duhai RRTS Branch, A/C: 57500002040668, IFSC: HDFC0011788.`
    ]
  },

  // 19. GODREJ GLOBAL BUSINESS CITY
  {
    name: 'GODREJ GLOBAL BUSINESS CITY',
    companyName: 'Godrej Properties',
    builder: 'Pirojsha Godrej',
    location: 'DMIC Integrated Township, Greater Noida, UP',
    propertyType: PropertyType.APARTMENT,
    startingPrice: 13500000, // 985 sq.ft
    endingPrice: 35000000, // 2500 sq.ft
    possessionDate: new Date('2029-06-01'),
    reraNumber: 'UPRERAPRJ11135',
    amenities: ['750-Acre DMIC Integrated Township', 'Plug & Play Smart Infrastructure', 'Underground Utilities & Optical Fiber', '1 KM to Eastern Peripheral Expressway', '10 KM to Pari Chowk & Yamuna Expressway'],
    description: 'Godrej Global Business City in Greater Noida (DMIC Integrated Township) spans 23.2 acres within a 750-acre smart city. 17 towers (G+30 floors, approx 3000 units). 1 BHK (985-1050 sq.ft, ₹1.35-₹1.45 Cr), 2 BHK (1320-1540 sq.ft, ₹1.85-₹2.15 Cr), 3 BHK (1690-2500 sq.ft, ₹2.35-₹3.50 Cr). BSP approx ₹14,000/sq.ft. Just 1 km to Eastern Peripheral Expressway, 40 km to Jewar International Airport.',
    chunks: [
      `PROJECT: GODREJ GLOBAL BUSINESS CITY
LOCATION: DMIC Integrated Township, Greater Noida, UP.
CONNECTIVITY: 1 KM to Eastern Peripheral Expressway, 4 KM to Boraki Multi-Modal Hub, 10 KM to Yamuna Expressway & Pari Chowk, 40 KM to Noida International Airport (Jewar).
BUILDER: Godrej Properties. Owner: Pirojsha Godrej.
LAND & TOWERS: 23.2 Acres in 750-Acre Smart City, 17 Towers, G+30 Floors, approx 3000 Units.
CONFIGURATIONS & STARTING PRICES:
- 1 BHK Grande: 985 Sq.Ft — ₹1.35 Cr (BSP ₹13,706)
- 1 BHK Luxe: 1050 Sq.Ft — ₹1.45 Cr (BSP ₹13,810)
- 2 BHK Grande: 1320 Sq.Ft — ₹1.85 Cr (BSP ₹14,015)
- 2 BHK + Study: 1540 Sq.Ft — ₹2.15 Cr (BSP ₹13,961)
- 3 BHK Grande: 1690 Sq.Ft — ₹2.35 Cr (BSP ₹13,905)
- 3 BHK: 1890 Sq.Ft — ₹2.60 Cr (BSP ₹13,757)
- 3 BHK + Study: 2300 Sq.Ft — ₹3.20 Cr (BSP ₹13,913)
- 3 BHK + Utility: 2500 Sq.Ft — ₹3.50 Cr (BSP ₹14,000)
OTHER CHARGES: PLC ₹1,000-₹3,000/sq.ft, EDC ₹250, IDC ₹250, IFMS ₹50, Car parking ₹2-3L. GST 5%.
BANK DETAILS: EOI Cheque in favour of "GODREJ".`
    ]
  },

  // 20. PARX LAUREATE – OVAL STUDIOS
  {
    name: 'PARX LAUREATE – OVAL STUDIOS',
    companyName: 'Laureate Buildwell Pvt Ltd',
    builder: 'Rajeev Sharma, Mahendra Bansal, Ishwar Chand Mittal',
    location: 'Plot No. GH-01, GH-02 & GH-03, Sector 108, Noida 201304',
    propertyType: PropertyType.APARTMENT,
    startingPrice: 13754360, // 809.08 sq.ft @ 17000
    endingPrice: 16205250, // 953.25 sq.ft @ 17000
    possessionDate: new Date('2026-12-01'),
    reraNumber: 'UPRERAPRJ5998',
    amenities: ['60,000 Sq.Ft Club Laureate', 'Fully Furnished (₹2L Included)', 'All Home Appliances Included (AC, Fridge, TV, RO, Hob, Chimney, Geyser)', 'Expressway Facing High-Rise Studio', '1-Year Free Maintenance'],
    description: 'Parx Laureate Oval Studios in Sector 108, Noida Expressway spans 10.94 acres with 1 luxury studio tower (G+25 floors, 168 units, sizes 809.08 & 953.25 sq.ft). Fully furnished with sofa, bed, wardrobes, TV unit + complete appliances (Split AC, fridge, microwave, RO, TV, geyser). BSP ₹17,000/sq.ft. 60,000 sq.ft Club Laureate membership lifetime free, 1-year free maintenance.',
    chunks: [
      `PROJECT: PARX LAUREATE – OVAL STUDIOS
LOCATION: Plot No. GH-01/02/03, Sector 108, Noida – 201304. RERA: UPRERAPRJ5998.
BUILDER: Laureate Buildwell Pvt Ltd. Owners: Rajeev Sharma, Mahendra Bansal, Ishwar Chand Mittal.
LAND & TOWER: 10.94 Acres (44,280 sq.m), 1 Dedicated Studio Tower, G+25 Floors, 168 Units (809.08 & 953.25 sq.ft).
FURNISHING & APPLIANCES INCLUDED (₹2 Lakh furniture fee): Sofa set, bed with mattress, study table, coffee table, Split AC, Hob, Chimney, Refrigerator, Microwave, RO, TV, Geyser, Video door phone.
PRICING: BSP ₹17,000/Sq.Ft. Expressway facing PLC ₹2,500/sq.ft. Parking ₹5L. IFMS ₹50, Lease rent ₹185, IDC/EDC ₹200. FOC: Lifetime Club Laureate membership + 1 Year Maintenance Free!
BANK DETAILS: Cheque in favour of "LAUREATE BUILDWELL PVT. LTD.", Bank of Baroda Noida Complex, A/C: 70030200001863, IFSC: BARB0VJNOID.`
    ]
  },

  // 21. ETERNIA BY GREAT VALUE REALTY
  {
    name: 'ETERNIA BY GREAT VALUE REALTY',
    companyName: 'Great Value Realty & Sanskar Realty',
    builder: 'Court Receiver (Supreme Court) / NBCC',
    location: 'Dream Valley Phase III, Tech Zone IV, Greater Noida West',
    propertyType: PropertyType.APARTMENT,
    startingPrice: 18160800, // 1932 sq.ft @ 9400
    endingPrice: 26512500, // 2625 sq.ft @ 10100
    possessionDate: new Date('2027-12-01'),
    reraNumber: 'UPRERAPRJ11136',
    amenities: ['Supreme Court & NBCC Managed Project', '25,000 Sq.Ft Clubhouse', 'Facing 100M Green Belt on 130M Wide Road', 'Fully Loaded Furnishing Included (₹0 Extra Payment)', 'No GST as per Supreme Court Guidelines'],
    description: 'Eternia by Great Value Realty in Dream Valley Phase III, Tech Zone IV, Greater Noida West is a Supreme Court-appointed Court Receiver project managed by NBCC. 6 acres, 6 towers (G+30 floors, 4 units/floor, 25,000 sq.ft clubhouse). Configurations: 3 BHK (1932 sq.ft), 3 BHK + Study (2239 sq.ft), 4 BHK + Study (2625 sq.ft). Fully loaded furnishing included (ACs, wardrobes, modular kitchen, 55" LED TV, microwave, geysers). BSP ₹9,400 to ₹10,100/sq.ft. No GST! Special 20:80 payment plan (No EMI till top floor / 18 months).',
    chunks: [
      `PROJECT: ETERNIA BY GREAT VALUE REALTY
LOCATION: Dream Valley Phase III, Tech Zone IV, Greater Noida West (Facing 100m green belt on 130m road).
MANAGEMENT: Supreme Court-Appointed Court Receiver, Managed by NBCC. Marketing: Great Value Realty & Sanskar Realty (Yatharth Hospitals Group).
LAND & TOWERS: 6 Acres, 6 Towers (A1 Lily, A2 Orchid, A3 Rose, A4 Dahlia, A5 Tulip, B Lotus), G+30 Floors, 4 units/floor, 25,000 sq.ft clubhouse.
FULLY LOADED OFFER INCLUDED: AC in all rooms, wardrobes, modular kitchen with chimney & hob, 55" LED TV, microwave, RO, geysers, video door phone.
CONFIGURATIONS & SUPER AREA:
- 3 BHK: 1932 Sq.Ft (Carpet 1086) — ₹1.81 Cr to ₹1.95 Cr
- 3 BHK + Study: 2239 Sq.Ft (Carpet 1333) — ₹2.26 Cr
- 4 BHK + Study: 2625 Sq.Ft (Carpet 1599) — ₹2.46 Cr to ₹2.65 Cr
SPECIAL PAYMENT PLAN (20:80): 10% booking, 10% in 45 days, 20% on 9th floor, 20% on 20th, 20% on 30th, 10% MEP/flooring, 5% paint, 5% possession. (No EMI for 18 months). No GST!
BANK DETAILS: Cheque in favour of "RECEIVER AMP NEW UNIT SALE OF DREAM VALLEY PHASE III ACCOUNT", UCO Bank Supreme Court Branch, A/C: 02070210004739, IFSC: UCBA0000207.`
    ]
  },

  // 22. SYNQ – IQ SUITES BY HI-LIFE
  {
    name: 'SYNQ – IQ SUITES BY HI-LIFE',
    companyName: 'Great Value Realty & Sanskar Realty',
    builder: 'Court Receiver (Supreme Court) / NBCC',
    location: 'Dream Valley, Tech Zone IV, Greater Noida West',
    propertyType: PropertyType.APARTMENT,
    startingPrice: 10218400, // 964 sq.ft @ 10600
    endingPrice: 16284800, // 1454 sq.ft @ 11200
    possessionDate: new Date('2027-09-01'),
    reraNumber: 'UPRERAPRJ11137',
    amenities: ['Fully Furnished with IKEA Furniture', 'Cleub Powered Smart Home Automation', 'Supreme Court & NBCC Managed Project', 'Gym, Yoga, Crèche & Kids Play Area', 'No GST Applicable'],
    description: 'Synq - IQ Suites by Hi-Life in Dream Valley, Tech Zone IV, Greater Noida West is a Supreme Court & NBCC managed project. 2.5 acres, G+18 floors (Commercial G-4th, Residential 5th-18th). 1 BHK (964 sq.ft super / 456 carpet) & 2 BHK (1454 sq.ft super / 688 carpet). Fully furnished with IKEA furniture + Cleub smart automation (touch switches, Alexa voice control, smart curtain tracks). BSP ₹10,600 to ₹11,200/sq.ft. Car parking free for 2 BHK. Special 40:40:20 payment plan.',
    chunks: [
      `PROJECT: SYNQ – IQ SUITES BY HI-LIFE
LOCATION: Dream Valley, Tech Zone IV, Greater Noida West.
MANAGEMENT: Supreme Court-Appointed Court Receiver, Managed by NBCC. Marketing: Great Value Realty & Sanskar Realty.
LAND & BUILDING: 2.5 Acres, G+18 Floors (Residential 5th-18th floor).
CONFIGURATIONS & SIZES:
- 1 BHK IQ Suite: 964 Sq.Ft Super (Carpet 456)
- 2 BHK IQ Suite: 1454 Sq.Ft Super (Carpet 688)
INCLUSIONS: Fully furnished with IKEA furniture (sofa, coffee table, bar stools, bed, wardrobes, study table, TV unit, 55" TV, microwave, fridge, RO, ACs) + Cleub smart home voice/touch automation.
PRICING: BSP ₹10,600 - ₹11,200/sq.ft. Car parking ₹5L (FREE for 2 BHK). No GST!
PAYMENT PLAN (40:40:20): 10% booking, 30% in 45 days, 40% on 18th floor roof, 10% MEP/flooring, 5% paint, 5% possession.
BANK DETAILS: Cheque in favour of "RECEIVER AMP NEW UNIT SALE OF DREAM VALLEY PHASE III ACCOUNT", UCO Bank Supreme Court Branch, A/C: 02070210004739, IFSC: UCBA0000207.`
    ]
  },

  // 23. ELYRIA BY APEX GROUP
  {
    name: 'ELYRIA BY APEX GROUP',
    companyName: 'Apex Group / Palatial Heights Pvt Ltd',
    builder: 'Satnam Singh Sachdeva (CMD, Apex Group)',
    location: 'Plot No. 8/GH-7, Sector-8, Siddharth Vihar Yojna, Ghaziabad, UP 201009',
    propertyType: PropertyType.APARTMENT,
    startingPrice: 18109000, // 1990 sq.ft @ 9100
    endingPrice: 28452500, // 2995 sq.ft @ 9500
    possessionDate: new Date('2028-12-01'),
    reraNumber: 'UPRERAPRJ11138',
    amenities: ['30,000+ Sq.Ft Elysian Club with Sky Bridge at 7M Height', 'Pickleball, Padel Court & Tennis', 'Adult, Kids, Lap & Jacuzzi Pools', 'Jogging Track at 7M Height', 'Work Station in Every Apartment', 'Vertical Gardens & Real Trees on Facade'],
    description: 'Elyria by Apex Group in Sector-8, Siddharth Vihar Yojna, Ghaziabad features 2 iconic towers (35 floors each, 5 flats/floor, 5 lifts/floor). Connected by a 7m high sky bridge. Luxury 3 BHK (1990, 1995 sq.ft), 3.5 BHK (2390, 2500 sq.ft), 4.5 BHK (2995 sq.ft). BSP ₹9,100 to ₹9,500/sq.ft. Car parking ₹5L, Club ₹3L, IFMS ₹20. Payment plan: 40% after RERA, 30% 15th floor, 20% 33rd floor, 10% on possession.',
    chunks: [
      `PROJECT: ELYRIA BY APEX GROUP
LOCATION: Plot No. 8/GH-7, Sector-8, Siddharth Vihar Yojna, Ghaziabad, UP 201009.
BUILDER: Palatial Heights Pvt Ltd (Apex Group). CMD: Satnam Singh Sachdeva.
LAND & TOWERS: 2 Towers (Tower A & B), 35 Floors Each (5 units/floor, 5 lifts/floor: 4 passenger + 1 service). 30,000+ sq.ft Elysian Club connected by 7m high sky bridge.
CONFIGURATIONS (Tower A & B):
- Unit 1: 3 BHK + 3T + Dress + Foyer: 1990 Sq.Ft (Carpet 1143.68, 4 Balconies)
- Unit 2: 3 BHK + 3T + Dress + Foyer: 1995 Sq.Ft (Carpet 1134.53, 4 Balconies)
- Unit 3: 3.5 BHK (3 BHK + 3T + Dress + Powder Room + WFH + Foyer): 2390 Sq.Ft (Carpet 1292.86, 4 Balconies)
- Unit 4: 3.5 BHK (3 BHK + 3T + Dress + Puja + Family Lounge + Foyer): 2500 Sq.Ft (Carpet 1365.20, 3 Balconies)
- Unit 5: 4.5 BHK (4 BHK + 3T + 2 Dress + Powder Room + Foyer): 2995 Sq.Ft (Carpet 1616.65, 4 Balconies)
PRICING: BSP 1st-15th floor ₹9,500/sq.ft | 16th-25th floor ₹9,300/sq.ft | 26th-35th floor ₹9,100/sq.ft. Car parking ₹5L, Club ₹3L, IFMS ₹20.
PAYMENT PLAN: 40% after RERA (within 1-2 months), 30% on 15th floor, 20% on 33rd floor (superstructure), 10% on offer of possession.
BANK DETAILS: Cheque in favour of "APEX HEIGHTS PVT LTD".`
    ]
  },

  // 24. APEX THE KREMLIN
  {
    name: 'APEX THE KREMLIN',
    companyName: 'Apex Heights Pvt Ltd',
    builder: 'Satnam Singh Sachdeva (CMD, Apex Group)',
    location: 'Plot No. 4 BS-2/3, Siddharth Vihar Yojna, Ghaziabad, UP',
    propertyType: PropertyType.APARTMENT,
    startingPrice: 9980000, // 998 sq.ft @ 10000
    endingPrice: 19215000, // 1830 sq.ft @ 10500
    possessionDate: new Date('2026-06-01'),
    reraNumber: 'UPRERAPRJ11139',
    amenities: ['Russian Luxury Gated Architecture', '46-Acre Park Opposite', 'Ganga Water Scheme', 'Gym & Swimming Pool', 'Amphitheatre & Sports Courts'],
    description: 'Apex The Kremlin in Siddharth Vihar Yojna, Ghaziabad spans 6.4 acres (26,000 sq.m) with 7 towers (A to G). Russian luxury architecture theme, opposite 46-acre lush green park. Configurations: 2 BHK (998 sq.ft), 2 BHK + Kids (1175, 1270 sq.ft), 3 BHK (1340, 1495, 1698 sq.ft), 4 BHK (1830 sq.ft). BSP ₹10,000/sq.ft for small units, ₹10,500/sq.ft for bigger units. Almost ready to move in (100% payment plan).',
    chunks: [
      `PROJECT: APEX THE KREMLIN
LOCATION: Plot No. 4 BS-2/3, Siddharth Vihar Yojna, Ghaziabad, UP.
BUILDER: Apex Heights Pvt Ltd (Apex Group). CMD: Satnam Singh Sachdeva.
LAND & TOWERS: 6.4 Acres (26,000 sq.m), 7 Towers (A to G). Russian luxury gated community theme opposite 46-acre public park.
CONFIGURATIONS & SIZES:
- 2 BHK + 2T: 998 Sq.Ft (Carpet 623.13)
- 2 BHK + 3T + Kids Room: 1175 & 1270 Sq.Ft
- 3 BHK + 2T: 1340 Sq.Ft (Carpet 760.05)
- 3 BHK + 3T: 1495 Sq.Ft (Carpet 888.35)
- 3 BHK + 3T + Store + Kids Room: 1698 Sq.Ft (Carpet 1062.62)
- 4 BHK + 4T: 1830 Sq.Ft (Carpet 1122.79)
PRICING: BSP ₹10,000/sq.ft (Small units), ₹10,500/sq.ft (Bigger units). Car parking ₹5L, Club ₹3L, IFMS ₹20/sq.ft.
PAYMENT PLAN: Almost Ready to Move In (100% Payment required).`
    ]
  },

  // 25. QUEBEC BY APEX GROUP
  {
    name: 'QUEBEC BY APEX GROUP',
    companyName: 'Apex Group / Shadbolt Buildworld Pvt Ltd',
    builder: 'Satnam Singh Sachdeva (CMD, Apex Group)',
    location: 'Plot No. 3/SP-10, Siddharth Vihar Yojna, Ghaziabad, UP 201009',
    propertyType: PropertyType.APARTMENT,
    startingPrice: 11400000, // 950 sq.ft @ 12000
    endingPrice: 33300000, // 2775 sq.ft @ 12000
    possessionDate: new Date('2026-09-01'),
    reraNumber: 'UPRERAPRJ239050',
    amenities: ['43 Acres UPAVP Park Opposite', 'North-East Facing 2-Side Open Vaastu Plot', 'Double Height Italian Marble Lobby', 'Grand Pavilion & Elevated Pavilion', 'Swimming Pool, Gym & Party Lawn'],
    description: 'Quebec by Apex Group in Siddharth Vihar Yojna, Ghaziabad spans 4.9 acres with 5 towers (A, B, C, D, E, up to 33 floors). 2-side open corner plot opposite 43-acre UPAVP park. Aluminium formwork construction, double-height Italian marble lobby. 2, 3 & 4 BHK apartments from 950 to 2775 sq.ft. BSP ₹12,000/sq.ft. Almost ready to move in (100% payment).',
    chunks: [
      `PROJECT: QUEBEC BY APEX GROUP
LOCATION: Plot No. 3/SP-10, Siddharth Vihar Yojna, Ghaziabad, UP 201009. RERA: UPRERAPRJ239050.
BUILDER: Shadbolt Buildworld Pvt Ltd (Apex Group). CMD: Satnam Singh Sachdeva.
LAND & TOWERS: 4.9 Acres, 5 Towers (A, B, C, D, E up to 33 floors). North-East facing 2-side open corner plot opposite 43-acre green park.
CONFIGURATIONS:
- Tower A: 2400, 2510, 2775 Sq.Ft (3 & 4 BHK)
- Tower B & C: 1680, 1770, 1960, 2080 Sq.Ft (3 & 4 BHK)
- Tower D: 950 & 1356 Sq.Ft (2 BHK)
- Tower E: 2070 Sq.Ft (3 BHK)
PRICING: BSP ₹12,000/Sq.Ft. Car parking ₹5L, Club ₹3L, IFMS ₹20/sq.ft.
PAYMENT PLAN: Almost Ready to Move In (100% Payment required).`
    ]
  },

  // 26. APEX ROSARIO BY APEX GROUP
  {
    name: 'APEX ROSARIO BY APEX GROUP',
    companyName: 'Apex Group / Palatial Heights Pvt Ltd',
    builder: 'Satnam Singh Sachdeva (CMD, Apex Group)',
    location: 'BS-2/4, Siddharth Vihar, Indirapuram, Ghaziabad, UP 201009',
    propertyType: PropertyType.APARTMENT,
    startingPrice: 21262500, // 2025 sq.ft @ 10500
    endingPrice: 37400000, // 3400 sq.ft @ 11000
    possessionDate: new Date('2028-12-01'),
    reraNumber: 'UPRERAPRJ11140',
    amenities: ['21,000 Sq.Ft Luxury Clubhouse', 'Drop-Offs at Each Tower', 'Swimming Pool & Basketball Court', 'Separate Residence / School Entry', 'High-Speed Elevators'],
    description: 'Apex Rosario by Apex Group in Siddharth Vihar (Indirapuram extension), Ghaziabad spans 5.5 acres with 4 towers (A, B, C, D, G+38 floors, 570 units, 4 lifts/floor). Luxury 3 & 4 BHK apartments from 2025 to 3400 sq.ft. BSP ₹10,500 to ₹11,000/sq.ft. Car parking ₹5L, Club ₹3L, IFMS ₹20. Payment plan: 40% after RERA, 30% on 15th floor, 20% on 33rd floor, 10% on possession.',
    chunks: [
      `PROJECT: APEX ROSARIO BY APEX GROUP
LOCATION: BS-2/4, Siddharth Vihar, Indirapuram, Ghaziabad, UP 201009.
BUILDER: Palatial Heights Pvt Ltd (Apex Group). CMD: Satnam Singh Sachdeva.
LAND & TOWERS: 5.5 Acres, 4 Towers (A, B, C, D), G+38 Floors, 570 Total Units (4 lifts/floor).
CONFIGURATIONS (3 & 4 BHK):
- Tower A (4 BHK + 4T): 2670, 2740, 2940, 3400 Sq.Ft
- Tower B (4 BHK + 4T + Servant): 2210, 2720, 2750 Sq.Ft
- Tower C (3 BHK + 3T): 2025, 2100, 2200 Sq.Ft
- Tower D (3 BHK + 3T): 2025, 2100, 2200 Sq.Ft
PRICING: BSP 1st-15th floor ₹11,000/sq.ft | 16th-24th floor ₹10,700/sq.ft | 25th-38th floor ₹10,500/sq.ft. Car parking ₹5L, Club ₹3L, IFMS ₹20/sq.ft.
PAYMENT PLAN: 40% after RERA (within 1-2 months), 30% on 15th floor, 20% on 33rd floor (superstructure), 10% on offer of possession.
BANK DETAILS: Cheque in favour of "PALATIAL HEIGHTS PVT LTD".`
    ]
  },

  // 27. NCR PRE-LAUNCH (KNOWLEDGE PARK 5)
  {
    name: 'NCR PRE-LAUNCH (KNOWLEDGE PARK 5)',
    companyName: 'Subh Advisor Pvt Ltd',
    builder: 'Ankit Sharma & PK Sharma',
    location: 'Plot No. 31, Knowledge Park 5, Greater Noida West, UP 201306',
    propertyType: PropertyType.COMMERCIAL,
    startingPrice: 6254305, // Studio 695 sq.ft @ 8999
    endingPrice: 44687500, // Villa 3575 sq.ft @ 12500
    possessionDate: new Date('2028-06-01'),
    reraNumber: 'UPRERAPRJ11141',
    amenities: ['10-Acre Integrated Township (5 Acre Resi + 5 Acre Comm)', 'Opposite Hiranandani Data Center', 'Interconnected 3-Tower Mega Mall', '48 Luxury Villas with Private Yards', 'Sunday Hotel LOI with ₹50/Sq.Ft Lease Guarantee'],
    description: 'NCR Pre-Launch on Plot 31, Knowledge Park 5, Greater Noida West spans 10 acres (5 acres residential with 3 towers & 48 luxury villas; 5 acres commercial with interconnected mall, office space G+14, studios, rooftop infinity pool & banquet). Opposite upcoming Hiranandani Data Center. Villas: 3475 & 3575 sq.ft (BSP ₹10,500 & ₹12,500). Studios: 695 & 795 sq.ft (BSP ₹8,999). Commercial Lower Ground ₹34,750, Ground ₹39,750/sq.ft. 50:25:25 payment plan.',
    chunks: [
      `PROJECT: NCR PRE-LAUNCH (KNOWLEDGE PARK 5)
LOCATION: Plot No. 31, Knowledge Park 5, Greater Noida West, UP 201306 (Opposite planned Hiranandani Data Center).
BUILDER: Subh Advisor Pvt Ltd. Owners: Ankit Sharma & PK Sharma.
LAND & SECTORS: 10 Acres Total. Residential: 5 Acres (3 towers + 48 luxury villas). Commercial: 5 Acres (3 towers: G+14 office space, 2 interconnected mall towers with retail, food court, banquet, and studios).
OFFERINGS & PRICING:
- Luxury Villas (48 units): 3475 & 3575 Sq.Ft | BSP ₹10,500 & ₹12,500/sq.ft | EOI ₹30 Lakh | Payment Plan 50:25:25.
- Commercial Studios: 695 & 795 Sq.Ft | BSP ₹8,999/sq.ft | EOI ₹5 Lakh | Payment Plan 50:25:25 (50% RERA, 25% 7th floor, 25% superstructure).
- Commercial Retail: Lower Ground ₹34,750/sq.ft | Ground Floor ₹39,750/sq.ft.
- Hotel / Lease Guarantee: ₹50/sq.ft stated lease guarantee up to 18 years (12-15% escalation every 3 years, Sunday Hotel Gurgaon LOI).
BANK DETAILS: Cheque in favour of "SHUBH ADVISOR PVT. LTD.". Loans from ICICI, Canara, HDFC.`
    ]
  },

  // 28. THE KUTUMB BY ADITYA
  {
    name: 'THE KUTUMB BY ADITYA',
    companyName: 'AAPL Projects Pvt Ltd (Aditya Builders)',
    builder: 'Aditya Uma (Building Trust Since 1979)',
    location: 'Aditya World City, Next to 14-Lane NH-24, Ghaziabad, UP',
    propertyType: PropertyType.APARTMENT,
    startingPrice: 32004000, // Type B 2667 sq.ft
    endingPrice: 39396000, // Type A 3283 sq.ft
    possessionDate: new Date('2029-09-01'),
    reraNumber: 'UPRERAPRJ572873/11/2024',
    amenities: ['Highest Ceiling Height 3.6M in NCR', '8.55M Club Ceiling Height', '4 Interconnected Towers with Sky Deck at 27th Floor', '270 Degree Panoramic Balconies', '10 Ft Party Decks & Penthouses', 'Next to 14-Lane NH-24 Expressway'],
    description: 'The Kutumb by Aditya in Aditya World City, next to 14-lane NH-24, Ghaziabad spans 5.5 acres with 4 interconnected towers (28 floors, 432 units, 4 flats/floor). Claimed highest ceiling height in NCR (3.6m) and 8.55m club ceiling. All corner apartments with panoramic 10 ft party decks. Ultra-luxury 4 BHK Type A (3283 sq.ft with family lounge ₹3.94 Cr) and 4 BHK Type B (2667 sq.ft ₹3.20 Cr). BSP ₹12,000 (discounted to ₹10,500/sq.ft). Possession Sept 2029. Payment plans: 25*4 or 10:20:20:20:25:5.',
    chunks: [
      `PROJECT: THE KUTUMB BY ADITYA
LOCATION: Aditya World City, next to 14-lane NH-24, Ghaziabad, UP. RERA: UPRERAPRJ572873/11/2024.
BUILDER: AAPL Projects Pvt Ltd (Aditya Builders & Developers, building trust since 1979). Owner: Aditya Uma.
LAND & TOWERS: 5.5 Acres, 4 Interconnected Towers (T1 to T4), 28 Floors, 432 Total Apartments (4 apartments per floor, all corner units with 270-degree panoramic views and 10 ft party decks).
USPs: 3.6m apartment ceiling height (highest in NCR), 8.55m club ceiling height, Sky deck on 27th floor with jogging track, putting greens & healing garden.
CONFIGURATIONS & PRICING:
- Type A (4 BHK + Family Lounge): 3283 Sq.Ft (Covered 2060.98, Carpet 1789.52, Balcony 561.74) — Basic Cost ₹3,93,96,000 (₹3.94 Cr)
- Type B (4 BHK): 2667 Sq.Ft (Covered 1776.48, Carpet 1507.18, Balcony 398.31) — Basic Cost ₹3,20,04,000 (₹3.20 Cr)
BSP PRICE: ₹12,000/sq.ft (Special discounted rate: ₹10,500/sq.ft + Floor PLC + GST 5%).
PAYMENT PLANS:
- 25*4: 10% booking, 15% in 45 days, 25% before 30 April 2027, 25% on superstructure, 25% on offer of possession.
- 10:20:20:20:25:5: 10% booking, 20% in 60 days, 20% 15th roof, 20% 28th roof, 25% CC application, 5% possession.
BANK DETAILS: Cheque in favour of "AAPL PROJECTS PVT. LTD. COLLECTION ACCOUNT FOR THE KUTUMB", Punjab & Sind Bank Kaushambi Ghaziabad, A/C: 12261100000459, IFSC: PSIB0001226.`
    ]
  }
];

async function main() {
  console.log('🔄 Cleaning up existing projects and knowledge chunks...');

  await prisma.projectKnowledgeChunk.deleteMany({});
  await prisma.projectKnowledgeSource.deleteMany({});

  await prisma.lead.updateMany({ data: { projectId: null } });
  await prisma.call.updateMany({ data: { projectId: null } });
  await prisma.appointment.updateMany({ data: { projectId: null } });
  await prisma.callCampaign.updateMany({ data: { projectId: null } });

  const deleted = await prisma.project.deleteMany({});
  console.log(`✅ Cleared ${deleted.count} old projects.`);

  console.log(`🏗️ Seeding all ${PDF_PROJECTS.length} projects from PDF catalogue...`);

  for (const item of PDF_PROJECTS) {
    const { chunks, ...projectData } = item;
    const project = await prisma.project.create({
      data: projectData,
    });

    console.log(`✅ Created Project: ${project.name} (${project.location})`);

    if (chunks && chunks.length > 0) {
      const source = await prisma.projectKnowledgeSource.create({
        data: {
          projectId: project.id,
          title: `${project.name} - Detailed Specifications & Pricing`,
          sourceType: KnowledgeSourceType.PRICE_SHEET,
          status: KnowledgeStatus.READY,
          rawText: chunks.join('\n\n'),
        },
      });

      for (let i = 0; i < chunks.length; i++) {
        await prisma.projectKnowledgeChunk.create({
          data: {
            projectId: project.id,
            sourceId: source.id,
            chunkIndex: i,
            content: chunks[i],
            tokenCount: Math.ceil(chunks[i].length / 4),
          },
        });
      }
    }
  }

  console.log('🎉 Successfully seeded all 28 PDF projects with complete RAG knowledge bases!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

