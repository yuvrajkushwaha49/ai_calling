const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const s = await prisma.aiAgentSettings.findFirst({
    select: { systemPrompt: true },
  });
  const p = s?.systemPrompt || '';
  console.log('FRESH WORDING:', /FRESH WORDING/i.test(p));
  console.log('no example dialogue:', !/may I know your requirement/i.test(p));
  console.log('len:', p.length);
  await prisma.$disconnect();
})();
