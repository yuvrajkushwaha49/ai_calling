import { detectIntent } from './call-scripts';

describe('detectIntent', () => {
  it('does NOT classify project selection queries as askingIdentity / askingWhyCall', () => {
    const text = 'सही बताओ तुम्हारे पास कौन-कौन से project अभी हैं? उसकी list बताओ मुझे एक बार।';
    const intent = detectIntent(text);
    expect(intent.askingIdentity).toBe(false);
    expect(intent.askingWhyCall).toBe(false);
    expect(intent.isGreeting).toBe(false);
  });

  it('does NOT classify "kaun se flat" or "kaun sa project" as askingIdentity', () => {
    const intent1 = detectIntent('kaun kaun se project hai aapke paas?');
    expect(intent1.askingIdentity).toBe(false);

    const intent2 = detectIntent('kaun sa floor available hai?');
    expect(intent2.askingIdentity).toBe(false);
  });

  it('correctly detects genuine identity inquiries', () => {
    const intent1 = detectIntent('aap kaun bol rahe ho?');
    expect(intent1.askingIdentity).toBe(true);

    const intent2 = detectIntent('tum kaun ho?');
    expect(intent2.askingIdentity).toBe(true);

    const intent3 = detectIntent('kis company se call kiya hai?');
    expect(intent3.askingIdentity).toBe(true);
  });
});

