/**
 * Event testing utilities for bots that subscribe to lifecycle events.
 */

import {
  CommandBot,
  BotContext,
  BotEventName,
  BotEventPayload,
  BotResponse,
} from '@colloquium/types';
import { createMockContext, MockContextOptions } from './mockContext';

export interface EventLogEntry<E extends BotEventName = BotEventName> {
  event: E;
  payload: BotEventPayload[E];
  result: BotResponse | void;
  timestamp: Date;
}

export interface EventTestHarness {
  /**
   * Fire an event handler on the bot with a mock context.
   */
  fireEvent<E extends BotEventName>(
    event: E,
    payload: BotEventPayload[E]
  ): Promise<BotResponse | void>;

  /**
   * Override context fields for subsequent event firings.
   */
  withContext(overrides: MockContextOptions): EventTestHarness;

  /**
   * Returns the log of all events fired through this harness.
   */
  getEventLog(): EventLogEntry[];

  /**
   * Clears the event log.
   */
  clearEventLog(): void;
}

/**
 * Creates a test harness for firing and inspecting bot event handlers.
 *
 * @example
 * ```ts
 * const harness = createEventTestHarness(myBot);
 * const result = await harness.fireEvent('manuscript.submitted', {
 *   manuscriptId: 'ms-123',
 * });
 * expect(harness.getEventLog()).toHaveLength(1);
 * ```
 */
export function createEventTestHarness(bot: CommandBot): EventTestHarness {
  let contextOverrides: MockContextOptions = {};
  const eventLog: EventLogEntry[] = [];

  const harness: EventTestHarness = {
    async fireEvent<E extends BotEventName>(
      event: E,
      payload: BotEventPayload[E]
    ): Promise<BotResponse | void> {
      const handler = bot.events?.[event];
      if (!handler) {
        throw new Error(
          `Bot "${bot.id}" has no handler for event "${event}". ` +
          `Registered events: ${bot.events ? Object.keys(bot.events).join(', ') : 'none'}`
        );
      }

      const context: BotContext = createMockContext(contextOverrides);

      const result = await (handler as (ctx: BotContext, p: BotEventPayload[E]) => Promise<BotResponse | void>)(
        context,
        payload
      );

      eventLog.push({
        event,
        payload,
        result,
        timestamp: new Date(),
      } as EventLogEntry);

      return result;
    },

    withContext(overrides: MockContextOptions): EventTestHarness {
      contextOverrides = { ...contextOverrides, ...overrides };
      return harness;
    },

    getEventLog(): EventLogEntry[] {
      return [...eventLog];
    },

    clearEventLog(): void {
      eventLog.length = 0;
    },
  };

  return harness;
}
