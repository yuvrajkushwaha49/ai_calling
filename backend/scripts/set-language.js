const { PrismaClient } = require('@prisma/client');
const path = require('path');
const { buildDefaultSalesAgentPrompt } = require('../dist/conversation/sales-agent-prompt.js');

const prisma = new PrismaClient();

async function main() {
  const targetLang = (process.argv[2] || 'hinglish').trim();
  console.log('Target Language to set:', targetLang);

  const existing = await prisma.aiAgentSettings.findFirst();
  console.log('Current DB row:', existing ? {
    id: existing.id,
    agentName: existing.agentName,
    agentVoice: existing.agentVoice,
    language: existing.language,
    tone: existing.tone,
    llmModel: existing.llmModel,
  } : 'NO ROW FOUND');

  const newPrompt = buildDefaultSalesAgentPrompt(targetLang);

  if (!existing) {
    console.log('Creating initial row with language:', targetLang);
    const created = await prisma.aiAgentSettings.create({
      data: {
        agentName: 'Aria',
        agentVoice: 'custom',
        language: targetLang,
        tone: 'friendly',
        llmModel: 'gemini-flash-lite-latest',
        systemPrompt: newPrompt,
      },
    });
    console.log('Created:', { id: created.id, language: created.language });
    return;
  }

  // Update DB directly
  const updated = await prisma.aiAgentSettings.update({
    where: { id: existing.id },
    data: {
      language: targetLang,
      systemPrompt: newPrompt,
    },
  });

  console.log('✅ Successfully updated DB AiAgentSettings:');
  console.log({
    id: updated.id,
    language: updated.language,
    promptLength: updated.systemPrompt ? updated.systemPrompt.length : 0,
    updatedAt: updated.updatedAt,
  });
}

main()
  .catch((e) => {
    console.error('❌ Error updating DB:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
