import { PrismaClient } from '@prisma/client';
import {
  deriveAutoLesson,
  normalizePlaybook,
  formatPlaybookForPrompt,
} from '../src/ai/playbook';

const prisma = new PrismaClient();

async function main() {
  const call = await prisma.call.findFirst({
    where: { status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      outcome: true,
      transcript: true,
      interestScore: true,
    },
  });
  if (!call) {
    console.log('No completed call to learn from');
    await prisma.$disconnect();
    return;
  }

  const lesson = deriveAutoLesson({
    outcome: String(call.outcome || ''),
    transcript: call.transcript,
    interestScore: call.interestScore,
  });
  if (!lesson) {
    console.log('No lesson derived');
    await prisma.$disconnect();
    return;
  }

  const settings = await prisma.aiAgentSettings.findFirst();
  if (!settings) throw new Error('No settings');

  const playbook = normalizePlaybook(settings.approvedPlaybook);
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!(playbook.autoLessons || []).some((l) => norm(l.lesson) === norm(lesson))) {
    playbook.autoLessons = [
      ...(playbook.autoLessons || []),
      {
        lesson,
        outcome: String(call.outcome || 'CONNECTED'),
        at: new Date().toISOString(),
        callId: call.id,
      },
    ].slice(-40);
    await prisma.aiAgentSettings.update({
      where: { id: settings.id },
      data: { approvedPlaybook: playbook as object },
    });
    console.log('SAVED lesson from call', call.id);
  } else {
    console.log('Lesson already present');
  }

  const after = await prisma.aiAgentSettings.findFirst({
    select: { approvedPlaybook: true },
  });
  const pb = normalizePlaybook(after?.approvedPlaybook);
  console.log('autoLessons now:', pb.autoLessons?.length);
  console.log('latest:', pb.autoLessons?.[pb.autoLessons.length - 1]);
  console.log('prompt inject:\n', formatPlaybookForPrompt(pb, 300));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
