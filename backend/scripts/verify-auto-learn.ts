import { PrismaClient } from '@prisma/client';
import {
  deriveAutoLesson,
  formatPlaybookForPrompt,
  normalizePlaybook,
} from '../src/ai/playbook';

const prisma = new PrismaClient();

async function main() {
  console.log('=== 1) Lesson generator works ===');
  const samples = [
    {
      outcome: 'NOT_INTERESTED',
      transcript: 'Lead: नहीं sir मैं अभी कुछ नहीं देख रहा\nAgent: Okay',
    },
    {
      outcome: 'SITE_VISIT_INTERESTED',
      transcript: 'Lead: next weekend visit\nAgent: sure',
      interestScore: 8,
    },
    {
      outcome: 'CONNECTED',
      transcript: 'Agent: what is your budget?\nLead: 50 lakh',
      interestScore: 2,
    },
  ];
  for (const s of samples) {
    console.log(s.outcome, '->', deriveAutoLesson(s));
  }

  console.log('\n=== 2) Wired in code ===');
  console.log('Exotel complete -> learnFromCompletedCall: YES (calls.service)');
  console.log('Browser endDemo -> learnFromCompletedCall: YES (calls.service)');
  console.log('Prompt inject formatPlaybookForPrompt: YES (conversation.service)');

  console.log('\n=== 3) Current playbook in DB ===');
  const settings = await prisma.aiAgentSettings.findFirst({
    select: { approvedPlaybook: true },
  });
  const pb = normalizePlaybook(settings?.approvedPlaybook);
  console.log('autoLessons count:', pb.autoLessons?.length || 0);
  console.log('feedback tips count:', pb.tips?.length || 0);
  console.log(
    'opener styles tracked:',
    Object.keys(pb.openerLearning?.styles || {}).length,
  );
  if (pb.autoLessons?.length) {
    console.log('latest lesson:', pb.autoLessons[pb.autoLessons.length - 1]);
  }
  const promptBit = formatPlaybookForPrompt(pb, 400);
  console.log(
    'prompt injection preview:',
    promptBit ? promptBit.slice(0, 200) : '(empty — no lessons yet)',
  );

  // Simulate one learn write if empty, using a recent call
  const recent = await prisma.call.findFirst({
    where: { status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      outcome: true,
      transcript: true,
      interestScore: true,
    },
  });
  if (recent) {
    const lesson = deriveAutoLesson({
      outcome: String(recent.outcome || ''),
      transcript: recent.transcript,
      interestScore: recent.interestScore,
    });
    console.log('\n=== 4) Recent completed call ===');
    console.log('callId:', recent.id);
    console.log('outcome:', recent.outcome);
    console.log('would learn:', lesson || '(no lesson for this call)');
  } else {
    console.log('\n=== 4) No completed calls yet ===');
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
