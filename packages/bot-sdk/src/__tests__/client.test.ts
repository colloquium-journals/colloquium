import { createBotClient } from '../client';

describe('createBotClient', () => {
  it('creates a client with all sub-clients', () => {
    const client = createBotClient({
      manuscriptId: 'ms-123',
      serviceToken: 'token-abc',
      config: { apiUrl: 'http://localhost:4000' },
    });

    expect(client.manuscripts).toBeDefined();
    expect(client.files).toBeDefined();
    expect(client.users).toBeDefined();
    expect(client.reviewers).toBeDefined();
    expect(client.storage).toBeDefined();
    expect(client.conversations).toBeDefined();
    expect(client.bots).toBeDefined();
    expect(client.apiUrl).toBe('http://localhost:4000');
  });

  it('falls back to API_URL env var when no config', () => {
    const original = process.env.API_URL;
    process.env.API_URL = 'http://env-api:4000';

    const client = createBotClient({
      manuscriptId: 'ms-123',
      serviceToken: 'token-abc',
    });

    expect(client.apiUrl).toBe('http://env-api:4000');
    process.env.API_URL = original;
  });

  it('falls back to localhost when no config or env', () => {
    const original = process.env.API_URL;
    delete process.env.API_URL;

    const client = createBotClient({
      manuscriptId: 'ms-123',
      serviceToken: 'token-abc',
    });

    expect(client.apiUrl).toBe('http://localhost:4000');
    process.env.API_URL = original;
  });
});
