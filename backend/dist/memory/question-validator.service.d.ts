import { ConversationState } from './memory.types';
export interface ValidationResult {
    sanitized: string;
    sanitizedText?: string;
    allowed?: boolean;
    wasRepeated: boolean;
    blockedField?: string;
    targetField?: string;
    replacementApplied?: boolean;
    reason?: string;
}
export declare class QuestionValidatorService {
    private readonly logger;
    private readonly questionDetectors;
    validateAndSanitize(first: ConversationState | string, second: ConversationState | string): ValidationResult;
    private getNextUnaskedQuestion;
}
