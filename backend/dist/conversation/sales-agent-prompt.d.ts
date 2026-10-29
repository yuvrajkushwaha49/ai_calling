export declare const SALES_AGENT_PROMPT_MARKER = "AI SALES CALLING AGENT";
export declare function buildDefaultSalesAgentPrompt(): string;
export declare function fillSalesAgentPrompt(template: string, vars: Record<string, string>): string;
export declare function isSalesAgentPrompt(text?: string | null): boolean;
export declare const INBOUND_AGENT_PROMPT_MARKER = "AI INBOUND HELPLINE AGENT";
export declare function buildDefaultInboundAgentPrompt(): string;
export declare function isInboundAgentPrompt(text?: string | null): boolean;
