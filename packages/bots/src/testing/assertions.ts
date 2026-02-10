/**
 * Jest assertion helpers for bot testing
 */

import { BotResponse } from '@colloquium/types';

/**
 * Verifies bot response structure and content
 */
export function assertBotResponse(
  response: BotResponse,
  expectations: {
    messageContains?: string | string[];
    messageCount?: number;
    hasAttachments?: boolean;
    hasActions?: boolean;
    actionCount?: number;
  }
): void {
  // Verify response exists
  expect(response).toBeDefined();

  // Check message count
  if (expectations.messageCount !== undefined) {
    expect(response.messages).toHaveLength(expectations.messageCount);
  }

  // Check message content
  if (expectations.messageContains !== undefined) {
    expect(response.messages).toBeDefined();
    expect(response.messages!.length).toBeGreaterThan(0);

    const fullContent = response.messages!.map(m => m.content).join('\n');
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
    } else {
      expect(response.messages?.every(m => !m.attachments || m.attachments.length === 0)).toBe(true);
    }
  }

  // Check actions
  if (expectations.hasActions !== undefined) {
    if (expectations.hasActions) {
      expect(response.actions).toBeDefined();
      expect(response.actions!.length).toBeGreaterThan(0);
    } else {
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
export function assertBotAction(
  response: BotResponse,
  expectations: {
    type: string;
    data?: Record<string, any>;
    index?: number;
  }
): void {
  expect(response.actions).toBeDefined();
  expect(response.actions!.length).toBeGreaterThan(0);

  const actionIndex = expectations.index ?? 0;
  expect(response.actions!.length).toBeGreaterThan(actionIndex);

  const action = response.actions![actionIndex];
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
export function assertBotError(
  response: BotResponse,
  expectations: {
    errorContains?: string;
    hasErrors?: boolean;
  }
): void {
  if (expectations.hasErrors !== undefined) {
    if (expectations.hasErrors) {
      expect(response.errors).toBeDefined();
      expect(response.errors!.length).toBeGreaterThan(0);
    } else {
      expect(!response.errors || response.errors.length === 0).toBe(true);
    }
  }

  if (expectations.errorContains !== undefined) {
    expect(response.errors).toBeDefined();
    expect(response.errors!.length).toBeGreaterThan(0);

    const allErrors = response.errors!.join(' ');
    expect(allErrors).toContain(expectations.errorContains);
  }
}

/**
 * Verifies that a response message does not contain specific text
 */
export function assertBotMessageNotContains(
  response: BotResponse,
  text: string | string[]
): void {
  expect(response.messages).toBeDefined();

  const fullContent = response.messages!.map(m => m.content).join('\n');
  const searchTerms = Array.isArray(text) ? text : [text];

  for (const term of searchTerms) {
    expect(fullContent).not.toContain(term);
  }
}

/**
 * Asserts that a bot response contains structured data matching expectations
 */
export function assertBotStructuredData(
  response: BotResponse,
  expectations: {
    type?: string;
    dataContains?: Record<string, any>;
    messageIndex?: number;
  }
): void {
  expect(response.messages).toBeDefined();
  const idx = expectations.messageIndex ?? 0;
  expect(response.messages!.length).toBeGreaterThan(idx);

  const msg = response.messages![idx];
  expect(msg.structuredData).toBeDefined();

  if (expectations.type !== undefined) {
    expect(msg.structuredData!.type).toBe(expectations.type);
  }

  if (expectations.dataContains !== undefined) {
    for (const [key, value] of Object.entries(expectations.dataContains)) {
      expect(msg.structuredData!.data[key]).toEqual(value);
    }
  }
}

/**
 * Asserts that a bot response contains annotations matching expectations
 */
export function assertBotAnnotations(
  response: BotResponse,
  expectations: {
    type?: 'warning' | 'error' | 'info' | 'suggestion';
    count?: number;
    messageContains?: string;
    messageIndex?: number;
  }
): void {
  expect(response.messages).toBeDefined();
  const idx = expectations.messageIndex ?? 0;
  expect(response.messages!.length).toBeGreaterThan(idx);

  const msg = response.messages![idx];
  expect(msg.annotations).toBeDefined();
  expect(msg.annotations!.length).toBeGreaterThan(0);

  if (expectations.count !== undefined) {
    const filtered = expectations.type
      ? msg.annotations!.filter(a => a.type === expectations.type)
      : msg.annotations!;
    expect(filtered).toHaveLength(expectations.count);
  }

  if (expectations.type !== undefined && expectations.count === undefined) {
    expect(msg.annotations!.some(a => a.type === expectations.type)).toBe(true);
  }

  if (expectations.messageContains !== undefined) {
    expect(
      msg.annotations!.some(a => a.message.includes(expectations.messageContains!))
    ).toBe(true);
  }
}

/**
 * Extended Jest matchers for bot testing
 */
export const botMatchers = {
  toContainBotMessage(
    received: BotResponse,
    expected: string
  ) {
    const pass = received.messages?.some(m => m.content.includes(expected)) ?? false;
    return {
      pass,
      message: () =>
        pass
          ? `expected response not to contain message "${expected}"`
          : `expected response to contain message "${expected}", but got: ${received.messages?.map(m => m.content).join('\n')}`
    };
  },

  toHaveBotAction(
    received: BotResponse,
    actionType: string
  ) {
    const pass = received.actions?.some(a => a.type === actionType) ?? false;
    return {
      pass,
      message: () =>
        pass
          ? `expected response not to have action type "${actionType}"`
          : `expected response to have action type "${actionType}", but got: ${received.actions?.map(a => a.type).join(', ') ?? 'no actions'}`
    };
  },

  toHaveProcessedCitations(
    received: BotResponse,
    citations: string[]
  ) {
    const fullContent = received.messages?.map(m => m.content).join('\n') ?? '';
    const foundAll = citations.every(cit => fullContent.includes(cit));
    return {
      pass: foundAll,
      message: () =>
        foundAll
          ? `expected response not to have processed all citations: ${citations.join(', ')}`
          : `expected response to have processed citations: ${citations.join(', ')}`
    };
  },

  toHaveIncludedAssets(
    received: BotResponse,
    assets: string[]
  ) {
    const fullContent = received.messages?.map(m => m.content).join('\n') ?? '';
    const foundAll = assets.every(asset => fullContent.includes(asset));
    return {
      pass: foundAll,
      message: () =>
        foundAll
          ? `expected response not to have included all assets: ${assets.join(', ')}`
          : `expected response to have included assets: ${assets.join(', ')}`
    };
  },

  toHaveBotStructuredData(
    received: BotResponse,
    expectedType?: string
  ) {
    const hasData = received.messages?.some(m => m.structuredData != null) ?? false;
    const typeMatches = expectedType
      ? received.messages?.some(m => m.structuredData?.type === expectedType) ?? false
      : hasData;
    return {
      pass: typeMatches,
      message: () =>
        typeMatches
          ? `expected response not to have structured data${expectedType ? ` of type "${expectedType}"` : ''}`
          : `expected response to have structured data${expectedType ? ` of type "${expectedType}"` : ''}`
    };
  },

  toHaveBotAnnotations(
    received: BotResponse,
    expectedType?: 'warning' | 'error' | 'info' | 'suggestion'
  ) {
    const hasAnnotations = received.messages?.some(
      m => m.annotations != null && m.annotations.length > 0
    ) ?? false;
    const typeMatches = expectedType
      ? received.messages?.some(
          m => m.annotations?.some(a => a.type === expectedType)
        ) ?? false
      : hasAnnotations;
    return {
      pass: typeMatches,
      message: () =>
        typeMatches
          ? `expected response not to have annotations${expectedType ? ` of type "${expectedType}"` : ''}`
          : `expected response to have annotations${expectedType ? ` of type "${expectedType}"` : ''}`
    };
  }
};

/**
 * Extends Jest with bot testing matchers
 */
export function extendJestWithBotMatchers(): void {
  expect.extend(botMatchers);
}

// Type declarations for custom matchers
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toContainBotMessage(expected: string): R;
      toHaveBotAction(actionType: string): R;
      toHaveProcessedCitations(citations: string[]): R;
      toHaveIncludedAssets(assets: string[]): R;
      toHaveBotStructuredData(expectedType?: string): R;
      toHaveBotAnnotations(expectedType?: 'warning' | 'error' | 'info' | 'suggestion'): R;
    }
  }
}
