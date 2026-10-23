const fs = require('fs');
const p = 'c:/Users/WORKIANS/Downloads/ai voice/backend/src/calls/calls.service.ts';
let text = fs.readFileSync(p, 'utf8');
const start = text.indexOf('  async demoTurn(body: {');
const end = text.lastIndexOf('}');
if (start < 0) throw new Error('demoTurn not found');
const newFn = fs.readFileSync(
  'c:/Users/WORKIANS/Downloads/ai voice/backend/src/calls/_demoTurn.snippet.ts',
  'utf8',
);
// Keep closing brace of class - snippet already includes final }
fs.writeFileSync(p, text.slice(0, start) + newFn + '\n');
console.log('replaced demoTurn');
