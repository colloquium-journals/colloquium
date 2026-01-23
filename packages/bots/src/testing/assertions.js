"use strict";
/**
 * Jest assertion helpers for bot testing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.botMatchers = void 0;
exports.assertBotResponse = assertBotResponse;
exports.assertBotAction = assertBotAction;
exports.assertBotError = assertBotError;
exports.assertBotMessageNotContains = assertBotMessageNotContains;
exports.extendJestWithBotMatchers = extendJestWithBotMatchers;
/**
 * Verifies bot response structure and content
 */
function assertBotResponse(response, expectations) {
    // Verify response exists
    expect(response).toBeDefined();
    // Check message count
    if (expectations.messageCount !== undefined) {
        expect(response.messages).toHaveLength(expectations.messageCount);
    }
    // Check message content
    if (expectations.messageContains !== undefined) {
        expect(response.messages).toBeDefined();
        expect(response.messages.length).toBeGreaterThan(0);
        const fullContent = response.messages.map(m => m.content).join('\n');
        const searchTerms = Array.isArray(expectations.messageContains)
            ? expectations.messageContains
            : [expectations.messageContains];
        for (const term of searchTerms) {
            expect(fullContent).toContain(term);
        }
    }
    // Check attachments
    if (expectations.hasAttachments !== undefined) {
        if (expectations.hasAttachments) {
            expect(response.messages?.some(m => m.attachments && m.attachments.length > 0)).toBe(true);
        }
        else {
            expect(response.messages?.every(m => !m.attachments || m.attachments.length === 0)).toBe(true);
        }
    }
    // Check actions
    if (expectations.hasActions !== undefined) {
        if (expectations.hasActions) {
            expect(response.actions).toBeDefined();
            expect(response.actions.length).toBeGreaterThan(0);
        }
        else {
            expect(!response.actions || response.actions.length === 0).toBe(true);
        }
    }
    // Check action count
    if (expectations.actionCount !== undefined) {
        expect(response.actions ?? []).toHaveLength(expectations.actionCount);
    }
}
/**
 * Verifies bot action structure and data
 */
function assertBotAction(response, expectations) {
    expect(response.actions).toBeDefined();
    expect(response.actions.length).toBeGreaterThan(0);
    const actionIndex = expectations.index ?? 0;
    expect(response.actions.length).toBeGreaterThan(actionIndex);
    const action = response.actions[actionIndex];
    expect(action.type).toBe(expectations.type);
    if (expectations.data !== undefined) {
        for (const [key, value] of Object.entries(expectations.data)) {
            expect(action.data[key]).toEqual(value);
        }
    }
}
/**
 * Verifies error response
 */
function assertBotError(response, expectations) {
    if (expectations.hasErrors !== undefined) {
        if (expectations.hasErrors) {
            expect(response.errors).toBeDefined();
            expect(response.errors.length).toBeGreaterThan(0);
        }
        else {
            expect(!response.errors || response.errors.length === 0).toBe(true);
        }
    }
    if (expectations.errorContains !== undefined) {
        expect(response.errors).toBeDefined();
        expect(response.errors.length).toBeGreaterThan(0);
        const allErrors = response.errors.join(' ');
        expect(allErrors).toContain(expectations.errorContains);
    }
}
/**
 * Verifies that a response message does not contain specific text
 */
function assertBotMessageNotContains(response, text) {
    expect(response.messages).toBeDefined();
    const fullContent = response.messages.map(m => m.content).join('\n');
    const searchTerms = Array.isArray(text) ? text : [text];
    for (const term of searchTerms) {
        expect(fullContent).not.toContain(term);
    }
}
/**
 * Extended Jest matchers for bot testing
 */
exports.botMatchers = {
    toContainBotMessage(received, expected) {
        const pass = received.messages?.some(m => m.content.includes(expected)) ?? false;
        return {
            pass,
            message: () => pass
                ? `expected response not to contain message "${expected}"`
                : `expected response to contain message "${expected}", but got: ${received.messages?.map(m => m.content).join('\n')}`
        };
    },
    toHaveBotAction(received, actionType) {
        const pass = received.actions?.some(a => a.type === actionType) ?? false;
        return {
            pass,
            message: () => pass
                ? `expected response not to have action type "${actionType}"`
                : `expected response to have action type "${actionType}", but got: ${received.actions?.map(a => a.type).join(', ') ?? 'no actions'}`
        };
    },
    toHaveProcessedCitations(received, citations) {
        const fullContent = received.messages?.map(m => m.content).join('\n') ?? '';
        const foundAll = citations.every(cit => fullContent.includes(cit));
        return {
            pass: foundAll,
            message: () => foundAll
                ? `expected response not to have processed all citations: ${citations.join(', ')}`
                : `expected response to have processed citations: ${citations.join(', ')}`
        };
    },
    toHaveIncludedAssets(received, assets) {
        const fullContent = received.messages?.map(m => m.content).join('\n') ?? '';
        const foundAll = assets.every(asset => fullContent.includes(asset));
        return {
            pass: foundAll,
            message: () => foundAll
                ? `expected response not to have included all assets: ${assets.join(', ')}`
                : `expected response to have included assets: ${assets.join(', ')}`
        };
    }
};
/**
 * Extends Jest with bot testing matchers
 */
function extendJestWithBotMatchers() {
    expect.extend(exports.botMatchers);
}
