const { PrismaClient } = require('@prisma/client');
const { deriveAutoLesson, normalizePlaybook, formatPlaybookForPrompt } = require('../src/ai/playbook.ts');
