const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BAD_NAMES = [
  'हैलो', 'हेलो', 'हॅलो', 'हालो',
  'नमस्ते', 'नमस्कार', 'प्रणाम', 'हाय',
  'hello', 'namaste', 'hi', 'hey',
  'inbound caller', 'guest', 'unknown', 'caller', 'customer', 'कस्टमर'
];

async function main() {
  console.log('🔍 Scanning leads for invalid/greeting names...');

  const leads = await prisma.lead.findMany({
    select: {
      id: true,
      name: true,
      phone: true,
    },
  });

  let count = 0;
  for (const lead of leads) {
    const raw = (lead.name || '').trim();
    const lower = raw.toLowerCase();

    const isBad =
      BAD_NAMES.includes(lower) ||
      BAD_NAMES.includes(raw) ||
      /^हैलो/i.test(raw) ||
      /^हेलो/i.test(raw) ||
      /^(hello|namaste|hi)\b/i.test(raw);

    if (isBad) {
      const phoneDigits = (lead.phone || '').replace(/\D/g, '');
      const suffix = phoneDigits.length >= 4 ? phoneDigits.slice(-4) : 'User';
      const cleanName = `Lead ${suffix}`;

      console.log(`Fixing lead ${lead.id} (${lead.phone}): "${lead.name}" ➔ "${cleanName}"`);

      await prisma.lead.update({
        where: { id: lead.id },
        data: { name: cleanName },
      });
      count++;
    }
  }

  console.log(`✅ Cleaned up ${count} lead(s) with invalid greeting names.`);
}

main()
  .catch((e) => {
    console.error('Error cleaning lead names:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

