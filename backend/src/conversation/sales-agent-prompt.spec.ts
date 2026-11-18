import {
  buildDefaultSalesAgentPrompt,
  buildDefaultInboundAgentPrompt,
} from './sales-agent-prompt';

describe('Sales Agent Prompt Language Generator', () => {
  it('generates Hinglish Hybrid script directive by default or when language is hinglish', () => {
    const prompt = buildDefaultSalesAgentPrompt('hinglish');
    expect(prompt).toContain('natural conversational HINGLISH using DEVANAGARI SCRIPT for Hindi words');
    expect(prompt).toContain('NEVER output Hindi in Roman English letters');

    const inbound = buildDefaultInboundAgentPrompt('hinglish');
    expect(inbound).toContain('natural conversational HINGLISH using DEVANAGARI SCRIPT for Hindi words');
    expect(inbound).toContain('नमस्ते {{customer_name}} जी!');
    expect(inbound).toContain('NEVER output Hindi in Roman English letters');
  });

  it('generates Devanagari Hindi directive when language is hi-IN', () => {
    const prompt = buildDefaultSalesAgentPrompt('hi-IN');
    expect(prompt).toContain('DEVANAGARI SCRIPT (देवनागरी लिपि)');

    const inbound = buildDefaultInboundAgentPrompt('hi-IN');
    expect(inbound).toContain('DEVANAGARI SCRIPT (देवनागरी लिपि)');
    expect(inbound).toContain('नमस्ते {{customer_name}} जी! {{company_name}} में आपका फिर से स्वागत है');
  });

  it('generates English directive when language is en-IN', () => {
    const prompt = buildDefaultSalesAgentPrompt('en-IN');
    expect(prompt).toContain('natural Indian English using Latin alphabet');

    const inbound = buildDefaultInboundAgentPrompt('en-IN');
    expect(inbound).toContain('natural, polite Indian English using Latin alphabet');
    expect(inbound).toContain('Hello {{customer_name}} ji! Welcome back to {{company_name}}');
  });
});
