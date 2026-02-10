/**
 * Integration test helper for running bots against a real API.
 *
 * Requires a running API server and database. Guards with
 * helpful error messages if the environment is not available.
 */

export interface IntegrationEnv {
  /**
   * Execute a bot command against the real API.
   */
  executeBot(
    botId: string,
    command: string,
    params?: Record<string, unknown>
  ): Promise<{
    messages?: Array<{ content: string; replyTo?: string }>;
    actions?: Array<{ type: string; data: Record<string, unknown> }>;
    errors?: string[];
  }>;

  /**
   * The API base URL used by this environment.
   */
  apiUrl: string;

  /**
   * The bot service token used for authentication.
   */
  serviceToken: string;

  /**
   * Cleanup resources.
   */
  teardown(): Promise<void>;
}

export interface IntegrationEnvOptions {
  apiUrl?: string;
  serviceToken?: string;
}

/**
 * Creates an integration test environment that makes real HTTP calls
 * to a running Colloquium API.
 *
 * @example
 * ```ts
 * let env: IntegrationEnv;
 *
 * beforeAll(async () => {
 *   env = await createIntegrationEnv();
 * });
 *
 * afterAll(async () => {
 *   await env.teardown();
 * });
 *
 * it('runs reference check', async () => {
 *   const result = await env.executeBot('bot-reference-check', 'check');
 *   expect(result.errors).toBeUndefined();
 * });
 * ```
 */
export async function createIntegrationEnv(
  options?: IntegrationEnvOptions
): Promise<IntegrationEnv> {
  const apiUrl = options?.apiUrl ?? process.env.API_URL ?? 'http://localhost:4000';
  const serviceToken =
    options?.serviceToken ??
    process.env.BOT_SERVICE_TOKEN ??
    'test-integration-token';

  // Verify the API is reachable
  try {
    const response = await fetch(`${apiUrl}/api/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Integration test environment requires a running API server.\n` +
      `  Expected API at: ${apiUrl}\n` +
      `  Error: ${message}\n\n` +
      `  Start the dev server first:\n` +
      `    npm run dev\n`
    );
  }

  return {
    apiUrl,
    serviceToken,

    async executeBot(
      botId: string,
      command: string,
      params?: Record<string, unknown>
    ) {
      const response = await fetch(`${apiUrl}/api/bots/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bot-token': serviceToken,
        },
        body: JSON.stringify({ botId, command, parameters: params }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Bot invocation failed (${response.status}): ${body}`
        );
      }

      return response.json();
    },

    async teardown() {
      // No persistent resources to clean up currently.
    },
  };
}
