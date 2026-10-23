const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.join(__dirname, '../src/conversation/sales-agent-prompt.ts'),
  'utf8',
);
const start = src.indexOf('return `# AI SALES CALLING AGENT');
const end = src.indexOf('`;', start);
if (start < 0 || end < 0) {
  console.error('Could not extract prompt from sales-agent-prompt.ts');
  process.exit(1);
}
const prompt = src.slice(start + 'return `'.length, end);

const prisma = new PrismaClient();
(async () => {
  const s = await prisma.aiAgentSettings.findFirst();
  if (!s) {
    console.log('No aiAgentSettings row yet — will be created on next backend start');
    await prisma.$disconnect();
    return;
  }
  await prisma.aiAgentSettings.update({
    where: { id: s.id },
    data: { systemPrompt: prompt },
  });
  console.log(
    'Synced systemPrompt:',
    prompt.includes('REAL TELECALLER FLOW'),
    'chars=',
    prompt.length,
  );
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
