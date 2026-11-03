const { PrismaClient, PropertyType, KnowledgeSourceType, KnowledgeStatus } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Cleaning up old projects and knowledge data...');

  // Delete all existing knowledge chunks and sources first
  await prisma.projectKnowledgeChunk.deleteMany({});
  await prisma.projectKnowledgeSource.deleteMany({});

  // Remove projectId link from existing leads/calls/appointments/campaigns
  await prisma.lead.updateMany({ data: { projectId: null } });
  await prisma.call.updateMany({ data: { projectId: null } });
  await prisma.appointment.updateMany({ data: { projectId: null } });
  await prisma.callCampaign.updateMany({ data: { projectId: null } });

  // Delete all existing projects
  const deletedProjects = await prisma.project.deleteMany({});
  console.log(`✅ Deleted ${deletedProjects.count} old projects.`);

  console.log('🏗️ Creating new projects: Palace Heights by Rudra & NCR Monarch...');

  // 1. PALACE HEIGHTS BY RUDRA
  const palaceHeights = await prisma.project.create({
    data: {
      name: 'PALACE HEIGHTS BY RUDRA',
      companyName: 'Rudra Buildwell',
      builder: 'Mukesh Khurana (Rudra Buildwell)',
      location: 'GH-02B, Sector 1, Noida Extension, Greater Noida West',
      propertyType: PropertyType.APARTMENT,
      startingPrice: 6090000, // 700 sq.ft @ 8700
      endingPrice: 19879500, // 2285 sq.ft @ 8700
      possessionDate: new Date('2027-05-01'), // 3 towers possession in 6 months
      reraNumber: 'UPRERAPRJ11124',
      amenities: [
        '30,000 Sq.Ft Luxury Clubhouse',
        '70% Green Area',
        '2-Side Open Plot',
        '22 Society Shops',
        'Swimming Pool & Kids Pool',
        'Fully Furnished 1 BHK Units',
        'Power Backup & 24/7 Security',
        'Dedicated Car Parking',
        'High-Speed Elevators',
      ],
      description:
        'Palace Heights by Rudra in GH-02B, Sector 1, Greater Noida West (Noida Extension) spans 8.27 acres with 10 towers (G+22 floors, 1434 units, 70% green area, 30,000 sq.ft clubhouse). Configurations: 1 BHK (700 sq.ft fully furnished), 2 BHK (1015, 1088 sq.ft), 3 BHK (1341, 1405, 1540, 1568 sq.ft), 4 BHK (1841, 2285 sq.ft). BSP @ ₹8,700/sq.ft. 50:50 payment plan. 3 towers ready for possession in 6 months.',
    },
  });

  // 2. NCR MONARCH
  const ncrMonarch = await prisma.project.create({
    data: {
      name: 'NCR MONARCH',
      companyName: 'JSS Buildcon Pvt Ltd',
      builder: 'Ankit Sharma & PK Sharma (JSS Buildcon)',
      location: 'GH-02C, Sector 1, Noida Extension, Greater Noida West',
      propertyType: PropertyType.APARTMENT,
      startingPrice: 6399360, // 720 sq.ft @ 8888
      endingPrice: 16087280, // 1810 sq.ft @ 8888
      possessionDate: new Date('2027-12-01'),
      reraNumber: 'UPRERAPRJ11125',
      amenities: [
        '30,000 Sq.Ft Clubhouse',
        '70% Green Area',
        '25 Society Commercial Shops',
        'Commercial Banquet Hall (T4 2nd Floor)',
        'Swimming Pool & Gymnasium',
        'Jogging Track & Kids Play Area',
        '24/7 Multi-Tier Security',
        'Covered Car Parking',
        'Power Backup & Water Supply',
      ],
      description:
        'NCR Monarch in GH-02C, Sector 1, Greater Noida West (Noida Extension) spans 3.75 acres with 4 towers (671 units, 70% green area, 30,000 sq.ft clubhouse). Configurations: 1 BHK (720, 905, 925, 1010 sq.ft), 2 BHK (1075, 1255 sq.ft), 3 BHK (1345, 1400, 1595, 1810 sq.ft), plus G+2 commercial shops and banquet hall. BSP @ ₹8,888/sq.ft.',
    },
  });

  console.log(`✅ Project created: ${palaceHeights.name} (ID: ${palaceHeights.id})`);
  console.log(`✅ Project created: ${ncrMonarch.name} (ID: ${ncrMonarch.id})`);

  // Helper to insert Knowledge Source & Chunks
  async function addKnowledge(projectId, title, sourceType, chunks) {
    const source = await prisma.projectKnowledgeSource.create({
      data: {
        projectId,
        title,
        sourceType,
        status: KnowledgeStatus.READY,
        rawText: chunks.join('\n\n'),
      },
    });

    for (let i = 0; i < chunks.length; i++) {
      await prisma.projectKnowledgeChunk.create({
        data: {
          projectId,
          sourceId: source.id,
          chunkIndex: i,
          content: chunks[i],
          tokenCount: Math.ceil(chunks[i].length / 4),
        },
      });
    }
  }

  // --- KNOWLEDGE BASE FOR PALACE HEIGHTS BY RUDRA ---
  console.log('📚 Adding Knowledge Chunks for Palace Heights by Rudra...');
  await addKnowledge(
    palaceHeights.id,
    'Palace Heights - Project Overview & Key Highlights',
    KnowledgeSourceType.PRICE_SHEET,
    [
      `PROJECT: PALACE HEIGHTS BY RUDRA
LOCATION: GH-02B, Sector 1, Noida Extension, Greater Noida West.
DEVELOPER / BUILDER: Rudra Buildwell. Owners: Mukesh Khurana.
LAND AREA: 8.27 Acres.
TOTAL TOWERS: 10 Towers. Building Height: G + 22 Floors.
PLOT TYPE: 2-Side Open Plot.
GREEN AREA: 70% Green Area.
TOTAL UNITS: 1434 Units.
CLUBHOUSE: Grand 30,000 Sq.Ft Clubhouse with premium lifestyle amenities.
COMMERCIAL SHOPS: 22 Society Shops (G+2 Floors, all sold out).
POSSESSION: 3 Towers ready for possession in 6 months (B1, B2, B6).
PHASES:
- Phase 1 (7 Towers): A1, A2, A3, A4, B1, B2, B6.
- Phase 2 (3 Towers - Future Towers): B3, B4, B5.
PAST PROJECTS: Aqua Casa.`,

      `PALACE HEIGHTS - APARTMENT CONFIGURATIONS & SIZES:
- 1 BHK: 700 Sq.Ft (Fully Furnished only for 1 BHK). Tower A4 (8 units/floor) and Tower B6 (8 units/floor).
- 2 BHK: 1015 Sq.Ft, 1088 Sq.Ft.
- 3 BHK: 1341 Sq.Ft, 1405 Sq.Ft, 1540 Sq.Ft, 1568 Sq.Ft.
- 4 BHK: 1841 Sq.Ft, 2285 Sq.Ft.

TOWER WISE DETAILS (Phase 1):
- Tower A1 (6 units/floor): 1405 sq.ft (2 units), 2285 sq.ft (2 units), 1568 sq.ft (1 unit), 1841 sq.ft (1 unit).
- Tower A2 (4 units/floor): 1540 sq.ft (2 units), 1568 sq.ft (1 unit), 1841 sq.ft (1 unit).
- Tower A3 (6 units/floor): 1405 sq.ft (2 units), 1540 sq.ft (2 units), 2285 sq.ft (2 units).
- Tower A4 (8 units/floor): 700 sq.ft (8 units, 1 BHK fully furnished).
- Tower B1 (6 units/floor - Possession in 6 months): 1015 sq.ft (2 units), 1540 sq.ft (2 units), 1405 sq.ft (2 units).
- Tower B2 (6 units/floor - Possession in 6 months): 1015 sq.ft (1 unit), 1088 sq.ft (3 units), 1341 sq.ft (1 unit), 1540 sq.ft (1 unit).
- Tower B6 (8 units/floor - Possession in 6 months): 700 sq.ft (8 units, 1 BHK).`,

      `PALACE HEIGHTS - PRICING, OTHER CHARGES & PAYMENT PLAN:
BSP PRICE: ₹8,700 / Sq.Ft.
(1 BHK is Fully Furnished at this price; other configurations are semi-furnished).
1 BHK approx ₹60.9 Lakhs onwards.
2 BHK (1015 sq.ft) approx ₹88.3 Lakhs onwards.
3 BHK (1341 sq.ft) approx ₹1.16 Cr onwards.
4 BHK (1841 sq.ft) approx ₹1.60 Cr onwards; 2285 sq.ft approx ₹1.98 Cr onwards.

OTHER CHARGES:
- Car Parking: ₹4,00,000 (4 Lakhs)
- Club Membership: ₹2,00,000 (2 Lakhs)
- Power Backup: ₹25,000 / KVA
- EEC / FFC: ₹40 / Sq.Ft
- IFMS: ₹40 / Sq.Ft
- Floor PLC: ₹30 / Sq.Ft
- Road Facing PLC: ₹200 / Sq.Ft
- Park Facing PLC: ₹200 / Sq.Ft
- Corner Unit PLC: ₹100 / Sq.Ft
- Lease Rent: ₹45 / Sq.Ft

PAYMENT PLAN:
- 50:50 Payment Plan (50% Now at booking/allotment, 50% on Offer of Possession).`,

      `PALACE HEIGHTS - BANK DETAILS, HOME LOANS & VICINITY:
LOAN STATUS: Home loans available from all leading nationalized and private banks (HDFC, SBI, ICICI, Axis, PNB).
CHEQUE / RTGS IN FAVOUR OF:
- Account Name: RBPPL COLLECTION ACCOUNT FOR RUDRA PALACEHEIGHTS
- Bank: HDFC BANK LTD
- Branch: Sector 63, Noida
- Account Number: 57500000114328
- IFSC Code: HDFC0000394

SURROUNDING LANDMARKS & NEAREST PROJECTS:
ATS Destinaire, Ace Divino, Antriksh Golf Links, Vihaan Greens, Arihant Amber, Agin Royal, Future World, Unibera Towers, Nirala Grand Reserve, Ace City, NCR Monarch, Gaur Mulberry Mansion in the immediate vicinity.`,
    ],
  );

  // --- KNOWLEDGE BASE FOR NCR MONARCH ---
  console.log('📚 Adding Knowledge Chunks for NCR Monarch...');
  await addKnowledge(
    ncrMonarch.id,
    'NCR Monarch - Project Overview & Key Highlights',
    KnowledgeSourceType.PRICE_SHEET,
    [
      `PROJECT: NCR MONARCH
LOCATION: GH-02C, Sector 1, Noida Extension, Greater Noida West.
DEVELOPER / BUILDER: JSS Buildcon Pvt Ltd. Owners: Ankit Sharma & PK Sharma.
LAND AREA: 3.75 Acres.
TOTAL TOWERS: 4 Towers.
TOTAL UNITS: 671 Units.
CLUBHOUSE: 30,000 Sq.Ft Clubhouse with state-of-the-art amenities.
GREEN AREA: 70% Lush Green Area.
COMMERCIAL & SOCIETY SHOPS: 25 Society Shops (G+2 Floors all sold out).
Tower 4 features Ground Floor Shops, First Floor Commercial Space, Second Floor Banquet Hall.
BUILDING HEIGHT & UNITS PER TOWER:
- Tower 1: G + 24 Floors, 8 flats/floor (200 units).
- Tower 2: G + 25 Floors, 8 flats/floor (208 units).
- Tower 3: G + 25 Floors, 8 flats/floor (208 units).
- Tower 4: G + 13 Floors, 5 flats/floor (Commercial G+2, 3rd to 14th floor: 1 BHK 55 units).`,

      `NCR MONARCH - APARTMENT CONFIGURATIONS & TOWER DETAILS:
BSP PRICE: ₹8,888 / Sq.Ft.

TOWER T1 (8 Flats/Floor, 200 Units):
- Unit 1 & 8: 2 BHK + 2T — 1255 Sq.Ft (2 units/floor)
- Unit 2, 3, 6, 7: 3 BHK + 2T — 1595 Sq.Ft (4 units/floor)
- Unit 4 & 5: 3 BHK + 3T — 1810 Sq.Ft (2 units/floor)

TOWER T2 (8 Flats/Floor, 208 Units):
- Unit 1, 4, 5, 8: 2 BHK + 2T — 1075 Sq.Ft (4 units/floor)
- Unit 2, 3, 6, 7 (Ground to 7th floor): 3 BHK + 2T — 1345 Sq.Ft (4 units/floor)
- Unit 2, 3, 6, 7 (8th to 25th floor): 3 BHK + 2T — 1400 Sq.Ft (4 units/floor)

TOWER T3 (8 Flats/Floor, 208 Units):
- Unit 1, 4, 5, 8: 2 BHK + 2T — 1255 Sq.Ft (4 units/floor)
- Unit 2, 3, 6, 7: 3 BHK + 3T — 1810 Sq.Ft (4 units/floor)

TOWER T4 (Commercial + 1 BHK Residential):
- Ground Floor, 1st Floor, 2nd Floor: Commercial shops (120 to 2500 sq.ft) & Banquet Hall.
- 3rd to 14th Floor: 1 BHK Apartments (55 Units total).
  Sizes: 720 Sq.Ft (2 units/floor), 905 Sq.Ft (1 unit/floor), 925 Sq.Ft (1 unit/floor), 1010 Sq.Ft (1 unit/floor).`,

      `NCR MONARCH - PRICING, OTHER CHARGES & PAYMENT PLAN:
BSP PRICE: ₹8,888 / Sq.Ft.
- 1 BHK (720 sq.ft): approx ₹64 Lakhs onwards.
- 2 BHK + 2T (1075 sq.ft): approx ₹95.5 Lakhs onwards.
- 2 BHK + 2T (1255 sq.ft): approx ₹1.11 Cr onwards.
- 3 BHK + 2T (1345 sq.ft): approx ₹1.19 Cr onwards; 1595 sq.ft approx ₹1.41 Cr onwards.
- 3 BHK + 3T (1810 sq.ft): approx ₹1.61 Cr onwards.

OTHER CHARGES:
- Car Parking: ₹4,95,000 (4.95 Lakhs)
- Club Membership: ₹3,00,000 (3 Lakhs)
- PLC Park / Club: ₹125 / Sq.Ft
- Road Facing PLC: ₹125 / Sq.Ft
- Water Connection: ₹25,000 (Lifetime)
- Meter Charges: ₹25,000 / KVA
- Power Backup: ₹25,000 / KVA
- IFMS: ₹35 / Sq.Ft
- Lease Rent: ₹85 / Sq.Ft
- Farmer Compensation: ₹65 / Sq.Ft
- Labour Welfare Cess: ₹25 / Sq.Ft`,

      `NCR MONARCH - BANK DETAILS, HOME LOANS & VICINITY:
LOAN STATUS: Approved and loans available from all major banks (HDFC, SBI, ICICI, etc.).
CHEQUE / RTGS IN FAVOUR OF:
- Account Name: JSS BUILDCON PVT LTD - COLLECTION ACCOUNT FOR NCR MONARCH
- Bank: ICICI BANK
- Branch: Nariman Point, Mumbai
- Account Number: 000405136921
- IFSC Code: ICIC0000004

NEAREST PROJECTS & VICINITY:
ATS Destinaire, Ace Divino, Antriksh Golf Links, Vihaan Greens, Arihant Amber, Agin Royal, Future World, Unibera Towers, Nirala Grand Reserve, Ace City, Palace Heights by Rudra, Gaur Mulberry Mansion in the immediate vicinity.`,
    ],
  );

  console.log('🎉 Successfully configured Palace Heights by Rudra and NCR Monarch with complete RAG knowledge base!');
}

main()
  .catch((e) => {
    console.error('❌ Error updating projects:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
