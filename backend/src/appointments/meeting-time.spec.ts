import { parseMeetingSlot, looksLikeMeetingRequest } from './meeting-time';

describe('Meeting Time Parser', () => {
  it('detects meeting request intent from keywords', () => {
    expect(looksLikeMeetingRequest('is weekend me visit karna chahunga')).toBe(true);
    expect(looksLikeMeetingRequest('सैंपल फ्लैट देखना है')).toBe(true);
    expect(looksLikeMeetingRequest('Sunday ko chalega')).toBe(true);
    expect(looksLikeMeetingRequest('site visit plan kar lijiye')).toBe(true);
    expect(looksLikeMeetingRequest('kal shaam 4 baje')).toBe(true);
  });

  it('parses weekend request without explicit hour to Saturday 11:00 AM', () => {
    const slot = parseMeetingSlot('Haan weekend me visit karunga');
    expect(slot).not.toBeNull();
    expect(slot?.time).toBe('11:00 AM');
    expect(slot?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('parses weekend confirmation when agent asked about weekend visit', () => {
    const prior = 'Agent: क्या आप इस वीकेंड प्रोजेक्ट का सैंपल फ्लैट देखने के लिए साइट विजिट प्लान करना चाहेंगे?';
    const slot = parseMeetingSlot('Haan bilkul chalega, book kar do', prior);
    expect(slot).not.toBeNull();
    expect(slot?.time).toBe('11:00 AM');
  });

  it('parses Sunday afternoon 4:00 PM', () => {
    const slot = parseMeetingSlot('Sunday ko shaam 4 baje aate hain');
    expect(slot).not.toBeNull();
    expect(slot?.time).toBe('4:00 PM');
  });

  it('parses Kal 5:00 PM', () => {
    const slot = parseMeetingSlot('Kal shaam 5 baje');
    expect(slot).not.toBeNull();
    expect(slot?.time).toBe('5:00 PM');
  });

  it('does not book when user explicitly declines', () => {
    const prior = 'Agent: क्या आप इस वीकेंड प्रोजेक्ट का सैंपल फ्लैट देखने के लिए साइट विजिट प्लान करना चाहेंगे?';
    const slot = parseMeetingSlot('Nahi abhi koi interest nahi hai, baad me dekhenge', prior);
    expect(slot).toBeNull();
  });
});

