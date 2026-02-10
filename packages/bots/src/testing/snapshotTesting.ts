/**
 * Snapshot testing utilities for bot responses.
 *
 * Normalizes dynamic values (UUIDs, timestamps) before snapshot
 * comparison so snapshots remain stable across runs.
 */

import { BotResponse } from '@colloquium/types';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const ISO_DATE_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g;

/**
 * Replace dynamic values with stable placeholders.
 */
function normalizeDynamicValues(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return obj
      .replace(UUID_RE, '<UUID>')
      .replace(ISO_DATE_RE, '<TIMESTAMP>');
  }
  if (Array.isArray(obj)) {
    return obj.map(normalizeDynamicValues);
  }
  if (obj !== null && typeof obj === 'object') {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      normalized[key] = normalizeDynamicValues(value);
    }
    return normalized;
  }
  return obj;
}

/**
 * Asserts that a bot response matches its snapshot after normalizing
 * dynamic values like UUIDs and timestamps.
 */
export function assertBotResponseSnapshot(response: BotResponse): void {
  const normalized = normalizeDynamicValues(response);
  expect(normalized).toMatchSnapshot();
}

/**
 * Custom Jest snapshot serializer that normalizes UUIDs and timestamps.
 *
 * Register with `expect.addSnapshotSerializer(createBotResponseSerializer())`.
 */
export function createBotResponseSerializer(): jest.SnapshotSerializerPlugin {
  return {
    test(val: unknown): boolean {
      return (
        val !== null &&
        typeof val === 'object' &&
        'messages' in (val as Record<string, unknown>)
      );
    },
    serialize(
      val: unknown,
      config: any,
      indentation: string,
      depth: number,
      refs: any[],
      printer: (val: unknown, config: any, indentation: string, depth: number, refs: any[]) => string
    ): string {
      const normalized = normalizeDynamicValues(val);
      return printer(normalized, config, indentation, depth, refs);
    },
  };
}
