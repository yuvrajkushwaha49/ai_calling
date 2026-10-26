export type ParsedMeetingSlot = {
    date: string;
    time: string;
    startIso: string;
    endIso: string;
    label: string;
};
export declare function looksLikeMeetingRequest(text: string): boolean;
export declare function parseMeetingSlot(userMessage: string, priorTranscript?: string | null): ParsedMeetingSlot | null;
