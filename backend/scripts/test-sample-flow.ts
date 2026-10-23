import { buildFollowUpReply } from '../src/calls/call-scripts';

const cases: Array<[string, string | null]> = [
  ['नहीं sir मैं अभी कुछ नहीं देख रहा अपने लिए', null],
  ['हां मैं plan कर रहा था', 'Agent: आप कुछ plan कर रहे हैं अभी?\n'],
  [
    'मैं 3 BHK apartment search कर रहा था',
    'Agent: Okay — आप 2 BHK देख रहे हैं या 3 BHK apartment?\n',
  ],
  [
    'मैं ready to move in property ढूंढ रहा हूं',
    'Lead: 3 BHK\nAgent: Okay तो under construction चलता है या ready to move in?\n',
  ],
  [
    'Next weekend',
    'Lead: 3 BHK\nLead: ready to move in\nAgent: Visit कब plan करेंगे?\n',
  ],
];

for (const [t, p] of cases) {
  const r = buildFollowUpReply({
    transcript: t,
    leadName: 'Akshant',
    language: 'hi-IN',
    priorTranscript: p,
    speechGender: 'male',
  });
  console.log('IN:', t.slice(0, 50));
  console.log('OUT:', r.text);
  console.log('---');
}
