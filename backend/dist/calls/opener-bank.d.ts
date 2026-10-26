import type { AppLanguage } from './call-scripts';
export type OpenerStyle = 'soft_time' | 'project_hook' | 'warm_checkin' | 'curiosity' | 'availability';
export declare const OPENER_STYLES: OpenerStyle[];
export type OpenerStat = {
    uses: number;
    wins: number;
};
export type OpenerLearning = {
    styles: Partial<Record<OpenerStyle, OpenerStat>>;
    preferredStyle?: OpenerStyle;
    lastStyle?: OpenerStyle;
};
export declare function pickOpenerStyle(learning?: OpenerLearning | null): OpenerStyle;
export declare function parseOpenerLearning(raw: unknown): OpenerLearning;
export declare function bestOpenerStyle(learning: OpenerLearning): OpenerStyle;
export declare function isOpeningStyleTip(note: string): boolean;
export declare function personalizeOpeningTip(tipNote: string, ctx: {
    leadName: string;
    agentName: string;
    companyHi: string;
    projectHi: string;
    bolHi: string;
    hasProject: boolean;
}): string;
export declare function speakAgentName(raw?: string | null): string;
export declare function buildVariedOpening(options: {
    leadName: string;
    agentName: string;
    projectName?: string | null;
    companyName?: string | null;
    builderName?: string | null;
    language?: string;
    tone?: string;
    agentVoice?: string;
    style?: OpenerStyle;
    learning?: OpenerLearning | null;
    hasLinkedProject?: boolean;
    openingTip?: string | null;
}): {
    text: string;
    style: OpenerStyle;
    language: AppLanguage;
};
