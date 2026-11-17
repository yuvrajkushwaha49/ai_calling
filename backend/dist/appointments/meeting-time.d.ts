export type ParsedMeetingSlot = {
    date: string;
    time: string;
    startIso: string;
    endIso: string;
    label: string;
    isTimeExplicit?: boolean;
    isDateExplicit?: boolean;
};
export declare function isGenericAcknowledgement(text: string): boolean;
export declare function isExplicitMeetingConfirmation(text: string): boolean;
export declare function looksLikeMeetingRequest(text: string): boolean;
export declare function parseMeetingSlot(userMessage: string, priorTranscript?: string | null, options?: {
    requireExplicitTime?: boolean;
}): ParsedMeetingSlot | null;
