import { PrismaClient, UserRole, LeadStatus, LeadSource, PropertyType, CallOutcome, AppointmentStatus } from '@prisma/client';
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
      name: 'Skyline Residences',
      location: 'Mumbai, Bandra West',
      builder: 'Prestige Builders',
      propertyType: PropertyType.APARTMENT,
      startingPrice: 8500000,
      endingPrice: 15000000,
      possessionDate: new Date('2027-06-01'),
      reraNumber: 'MH/RERA/2024/001',
      amenities: ['Swimming Pool', 'Gym', 'Clubhouse', '24/7 Security', 'Parking'],
      description: 'Premium 2 & 3 BHK apartments with sea-facing views in Bandra West.',
    },
  });

  const project2 = await prisma.project.create({
    data: {
      name: 'Green Valley Villas',
      location: 'Pune, Hinjewadi',
      builder: 'Green Homes Ltd',
      propertyType: PropertyType.VILLA,
      startingPrice: 12000000,
      endingPrice: 25000000,
      possessionDate: new Date('2026-12-01'),
      reraNumber: 'MH/RERA/2024/002',
      amenities: ['Garden', 'Private Pool', 'Smart Home', 'EV Charging'],
      description: 'Luxury villas with modern amenities in Hinjewadi IT corridor.',
    },
  });

  const leads = await Promise.all([
    prisma.lead.create({
      data: {
        name: 'Rajesh Kumar',
        phone: '+91 98765 43210',
        email: 'rajesh@email.com',
        source: LeadSource.WEBSITE,
        budget: 10000000,
        propertyType: PropertyType.APARTMENT,
        status: LeadStatus.QUALIFIED,
        projectId: project1.id,
        aiSummary: 'Interested in 3BHK sea-facing unit. Budget flexible up to 1.2Cr. Ready for site visit.',
      },
    }),
    prisma.lead.create({
      data: {
        name: 'Priya Sharma',
        phone: '+91 87654 32109',
        email: 'priya@email.com',
        source: LeadSource.REFERRAL,
        budget: null,
        propertyType: PropertyType.VILLA,
        status: LeadStatus.CONTACTED,
        projectId: project2.id,
      },
    }),
    prisma.lead.create({
      data: {
        name: 'Amit Patel',
        phone: '+91 76543 21098',
        email: 'amit@email.com',
        source: LeadSource.SOCIAL_MEDIA,
        budget: null,
        propertyType: PropertyType.APARTMENT,
        status: LeadStatus.NEW,
      },
    }),
    prisma.lead.create({
      data: {
        name: 'Sneha Reddy',
        phone: '+91 65432 10987',
        email: 'sneha@email.com',
        source: LeadSource.COLD_CALL,
        budget: 20000000,
        propertyType: PropertyType.PENTHOUSE,
        status: LeadStatus.NEGOTIATION,
        projectId: project1.id,
        aiSummary: 'High-value lead. Interested in penthouse. Negotiating on payment plan.',
      },
    }),
    prisma.lead.create({
      data: {
        name: 'Vikram Singh',
        phone: '+91 54321 09876',
        email: 'vikram@email.com',
        source: LeadSource.WALK_IN,
        budget: 9500000,
        propertyType: PropertyType.APARTMENT,
        status: LeadStatus.CONVERTED,
        projectId: project1.id,
      },
    }),
  ]);

  for (const lead of leads) {
    await prisma.call.create({
      data: {
        leadId: lead.id,
        duration: Math.floor(Math.random() * 600) + 60,
        transcript: `Agent: Hello, this is calling from Real Estate CRM regarding your property inquiry.\nLead: Yes, I'm interested in learning more.\nAgent: Great! Let me share the available options...`,
        summary: `Lead ${lead.name} showed interest. Discussed budget and preferences. Follow-up scheduled.`,
        recordingUrl: 'https://example.com/recordings/sample.mp3',
        outcome: CallOutcome.CONNECTED,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  await prisma.appointment.create({
    data: {
      leadId: leads[0].id,
      projectId: project1.id,
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      time: '10:00 AM',
      status: AppointmentStatus.SCHEDULED,
    },
  });

  await prisma.appointment.create({
    data: {
      leadId: leads[1].id,
      projectId: project2.id,
      date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      time: '2:00 PM',
      status: AppointmentStatus.SCHEDULED,
    },
  });

  await prisma.activity.createMany({
    data: [
      { leadId: leads[0].id, userId: agent.id, type: 'CALL_LOGGED', description: 'Outbound AI call completed' },
      { leadId: leads[0].id, userId: agent.id, type: 'STATUS_CHANGED', description: 'Status changed to QUALIFIED' },
      { leadId: leads[3].id, userId: admin.id, type: 'NOTE_ADDED', description: 'Negotiation in progress' },
      { leadId: leads[4].id, userId: agent.id, type: 'STATUS_CHANGED', description: 'Lead converted!' },
    ],
  });

  await prisma.aiAgentSettings.create({
    data: {
      agentName: 'Aria - Real Estate Assistant',
      agentVoice: 'shubh',
      language: 'en-IN',
      systemPrompt: `You are an AI sales calling agent for real estate. Qualify leads, answer from knowledge, and move toward a site visit or meeting. Speak calm Hinglish. Soft acks only. Never say "वाह". Keep replies short.`,
      workingHours: { start: '09:00', end: '18:00', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
      knowledgeBase: ['project-brochure-skyline.pdf', 'pricing-sheet-2024.pdf'],
    },
  });

  console.log('✅ Seed completed');
  console.log('   Admin: admin@realestatecrm.com / password123');
  console.log('   Agent: agent@realestatecrm.com / password123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
