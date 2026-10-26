import type { OpenerLearning } from '../calls/opener-bank';
export { isOpeningStyleTip, personalizeOpeningTip } from '../calls/opener-bank';
export type PlaybookTip = {
    note: string;
    rating?: string;
    source: 'feedback' | 'auto';
    at: string;
};
export type AutoLesson = {
    lesson: string;
    outcome: string;
    at: string;
    callId?: string;
};
export type ImprovementKind = 'auto_lesson' | 'feedback_tip' | 'opener_preferred';
export type ImprovementEvent = {
    at: string;
    kind: ImprovementKind;
    summary: string;
    detail?: string;
    callId?: string;
};
export type AgentPlaybook = {
    openerLearning?: OpenerLearning;
    tips?: PlaybookTip[];
    autoLessons?: AutoLesson[];
    improvementHistory?: ImprovementEvent[];
};
export declare function appendImprovement(playbook: AgentPlaybook, event: Omit<ImprovementEvent, 'at'> & {
    at?: string;
}): AgentPlaybook;
export declare function normalizePlaybook(raw: unknown): AgentPlaybook;
export declare function formatPlaybookForPrompt(raw: unknown, maxChars?: number): string;
export declare function latestOpeningStyleTip(raw: unknown): string | null;
export declare function deriveAutoLesson(input: {
    outcome?: string | null;
    transcript?: string | null;
    interestScore?: number | null;
}): string | null;
