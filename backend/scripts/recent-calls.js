const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const calls = await prisma.call.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: {
      id: true,
      createdAt: true,
      transcript: true,
      greetingText: true,
      status: true,
    },
  });
  for (const c of calls) {
    console.log('====', c.id, c.status, c.createdAt);
    console.log('GREETING:', (c.greetingText || '').slice(0, 300));
    console.log('TRANSCRIPT:\n', (c.transcript || '(empty)').slice(0, 2000));
    console.log();
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
