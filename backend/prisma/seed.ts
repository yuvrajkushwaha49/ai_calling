import {
  PrismaClient,
  UserRole,
  LeadStatus,
  LeadSource,
  PropertyType,
  CallOutcome,
  AppointmentStatus,
  KnowledgeSourceType,
  KnowledgeStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@realestatecrm.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@realestatecrm.com',
      password,
      role: UserRole.ADMIN,
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: 'agent@realestatecrm.com' },
    update: {},
    create: {
      name: 'Sales Agent',
      email: 'agent@realestatecrm.com',
      password,
      role: UserRole.AGENT,
    },
  });

  const project1 = await prisma.project.create({
    data: {
      name: 'PALACE HEIGHTS BY RUDRA',
      companyName: 'Rudra Buildwell',
      builder: 'Mukesh Khurana (Rudra Buildwell)',
      location: 'GH-02B, Sector 1, Noida Extension, Greater Noida West',
      propertyType: PropertyType.APARTMENT,
      startingPrice: 6090000,
      endingPrice: 19879500,
      possessionDate: new Date('2027-05-01'),
      reraNumber: 'UPRERAPRJ11124',
      amenities: [
        '30,000 Sq.Ft Clubhouse',
        '70% Green Area',
        '2-Side Open Plot',
        '22 Society Shops',
        'Fully Furnished 1 BHK',
        'Power Backup & 24/7 Security',
        'Dedicated Car Parking',
      ],
      description:
        'Palace Heights by Rudra in GH-02B, Sector 1, Greater Noida West spans 8.27 acres with 10 towers (G+22 floors, 1434 units, 70% green area, 30,000 sq.ft clubhouse). Configurations: 1 BHK (700 sq.ft fully furnished), 2 BHK (1015, 1088 sq.ft), 3 BHK (1341, 1405, 1540, 1568 sq.ft), 4 BHK (1841, 2285 sq.ft). BSP ₹8,700/sq.ft. 50:50 payment plan. 3 towers ready for possession in 6 months.',
    },
  });

  const project2 = await prisma.project.create({
    data: {
      name: 'NCR MONARCH',
      companyName: 'JSS Buildcon Pvt Ltd',
      builder: 'Ankit Sharma & PK Sharma (JSS Buildcon)',
      location: 'GH-02C, Sector 1, Noida Extension, Greater Noida West',
      propertyType: PropertyType.APARTMENT,
      startingPrice: 6399360,
      endingPrice: 16087280,
      possessionDate: new Date('2027-12-01'),
      reraNumber: 'UPRERAPRJ11125',
      amenities: [
        '30,000 Sq.Ft Clubhouse',
        '70% Green Area',
        '25 Society Commercial Shops',
        'Commercial Banquet Hall',
        'Swimming Pool & Gym',
        'Covered Parking',
      ],
      description:
        'NCR Monarch in GH-02C, Sector 1, Greater Noida West spans 3.75 acres across 4 towers with 671 units. 1 BHK (720-1010 sq.ft), 2 BHK (1075, 1255), 3 BHK (1345-1810), and G+2 commercial shops & banquet hall. BSP ₹8,888/sq.ft.',
    },
  });

  const leads = await Promise.all([
    prisma.lead.create({
      data: {
        name: 'Rajesh Kumar',
        phone: '+91 98765 43210',
        email: 'rajesh@email.com',
        source: LeadSource.WEBSITE,
        budget: 9000000,
        propertyType: PropertyType.APARTMENT,
        status: LeadStatus.QUALIFIED,
        projectId: project1.id,
        bhkPreference: '2BHK',
        preferredLocation: 'Sector 1 Noida Extension',
        aiSummary: 'Interested in 2BHK 1015 sq.ft in Palace Heights. Budget around 90L.',
      },
    }),
    prisma.lead.create({
      data: {
        name: 'Priya Sharma',
        phone: '+91 87654 32109',
        email: 'priya@email.com',
        source: LeadSource.REFERRAL,
        budget: 12000000,
        propertyType: PropertyType.APARTMENT,
        status: LeadStatus.CONTACTED,
        projectId: project2.id,
        bhkPreference: '3BHK',
        preferredLocation: 'Noida Extension',
        aiSummary: 'Looking for 3BHK 1345 sq.ft in NCR Monarch.',
      },
    }),
  ]);

  for (const lead of leads) {
    await prisma.call.create({
      data: {
        leadId: lead.id,
        projectId: lead.projectId,
        duration: 180,
        transcript: `Agent: Hello, this is calling from property helpline regarding your enquiry.\nLead: Yes, I was looking for a 2BHK flat in Noida Extension.\nAgent: Great! We have Palace Heights by Rudra and NCR Monarch in Sector 1.`,
        summary: `Lead ${lead.name} interested in Sector 1 Noida Extension projects.`,
        outcome: CallOutcome.CONNECTED,
      },
    });
  }

  await prisma.appointment.create({
    data: {
      leadId: leads[0].id,
      projectId: project1.id,
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      time: '11:00 AM',
      status: AppointmentStatus.SCHEDULED,
      notes: 'Site visit for Palace Heights sample flat',
    },
  });

  await prisma.aiAgentSettings.create({
    data: {
      agentName: 'Neha - Property Advisor',
      agentVoice: 'rachel',
      language: 'en-IN',
      systemPrompt: `You are an AI property advisor for Palace Heights by Rudra and NCR Monarch in Sector 1, Greater Noida West / Noida Extension. Answer customer queries with accuracy from Knowledge and guide them toward a site visit.`,
      workingHours: { start: '09:00', end: '19:00', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
    },
  });

  console.log('✅ Seed completed successfully with Palace Heights by Rudra and NCR Monarch');
  console.log('   Admin: admin@realestatecrm.com / password123');
  console.log('   Agent: agent@realestatecrm.com / password123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
