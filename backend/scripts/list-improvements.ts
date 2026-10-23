import { PrismaClient } from '@prisma/client';
import { normalizePlaybook } from '../src/ai/playbook';

const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.aiAgentSettings.findFirst({
    select: { approvedPlaybook: true, updatedAt: true },
  });
  const pb = normalizePlaybook(settings?.approvedPlaybook);

  console.log('=== AUTO LESSONS (call se seekha) ===');
  const lessons = pb.autoLessons || [];
  if (!lessons.length) console.log('(abhi koi nahi)');
  lessons.forEach((l, i) => {
    console.log(`${i + 1}. [${l.outcome}] ${l.lesson}`);
    console.log(`   at: ${l.at} | call: ${l.callId || '-'}`);
  });

  console.log('\n=== FEEDBACK TIPS (manual approve) ===');
  const tips = pb.tips || [];
  if (!tips.length) console.log('(abhi koi nahi)');
  tips.forEach((t, i) => {
    console.log(`${i + 1}. [${t.source}/${t.rating || '-'}] ${t.note}`);
  });

  console.log('\n=== OPENER LEARNING (auto) ===');
  const styles = pb.openerLearning?.styles || {};
  const keys = Object.keys(styles);
  if (!keys.length) console.log('(abhi koi nahi)');
  for (const k of keys) {
    const s = styles[k as keyof typeof styles]!;
    const rate = s.uses ? ((s.wins / s.uses) * 100).toFixed(0) : '0';
    console.log(`- ${k}: uses=${s.uses}, wins=${s.wins}, winRate=${rate}%`);
  }
  console.log('preferredStyle:', pb.openerLearning?.preferredStyle || '(none yet)');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
