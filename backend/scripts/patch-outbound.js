const fs = require('fs');
const p = 'c:/Users/WORKIANS/Downloads/ai voice/backend/src/calls/calls.service.ts';
let text = fs.readFileSync(p, 'utf8');
const start = text.indexOf('  async startOutboundCall(');
const end = text.indexOf('  async getVoiceTwiml(');
if (start < 0 || end < 0) throw new Error('markers not found ' + start + ' ' + end);
const newFn = fs.readFileSync(
  'c:/Users/WORKIANS/Downloads/ai voice/backend/src/calls/_startOutbound.snippet.ts',
  'utf8',
);
fs.writeFileSync(p, text.slice(0, start) + newFn + '\n\n' + text.slice(end));
console.log('replaced startOutboundCall');
