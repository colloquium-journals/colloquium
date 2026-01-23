/**
 * Jest assertion helpers for bot testing
 */
import { BotResponse } from '@colloquium/types';
/**
 * Verifies bot response structure and content
 */
export declare function assertBotResponse(response: BotResponse, expectations: {
    messageContains?: string | string[];
    messageCount?: number;
    hasAttachments?: boolean;
    hasActions?: boolean;
    actionCount?: number;
}): void;
/**
 * Verifies bot action structure and data
 */
export declare function assertBotAction(response: BotResponse, expectations: {
    type: string;
    data?: Record<string, any>;
    index?: number;
}): void;
/**
 * Verifies error response
 */
export declare function assertBotError(response: BotResponse, expectations: {
    errorContains?: string;
    hasErrors?: boolean;
}): void;
/**
 * Verifies that a response message does not contain specific text
 */
export declare function assertBotMessageNotContains(response: BotResponse, text: string | string[]): void;
/**
 * Extended Jest matchers for bot testing
 */
export declare const botMatchers: {
    toContainBotMessage(received: BotResponse, expected: string): {
        pass: boolean;
        message: () => string;
    };
    toHaveBotAction(received: BotResponse, actionType: string): {
        pass: boolean;
        message: () => string;
    };
    toHaveProcessedCitations(received: BotResponse, citations: string[]): {
        pass: boolean;
        message: () => string;
    };
    toHaveIncludedAssets(received: BotResponse, assets: string[]): {
        pass: boolean;
        message: () => string;
    };
};
/**
 * Extends Jest with bot testing matchers
 */
export declare function extendJestWithBotMatchers(): void;
declare global {
    namespace jest {
        interface Matchers<R> {
            toContainBotMessage(expected: string): R;
            toHaveBotAction(actionType: string): R;
            toHaveProcessedCitations(citations: string[]): R;
            toHaveIncludedAssets(assets: string[]): R;
        }
    }
}
//# sourceMappingURL=assertions.d.ts.map