import { generateJWT, verifyJWT, generateSecureToken } from '../index';

describe('generateJWT / verifyJWT', () => {
  const payload = {
    userId: 'user-123',
    email: 'test@example.com',
    role: 'USER',
  };

  it('generates a valid JWT that can be verified', () => {
    const token = generateJWT(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const decoded = verifyJWT(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(payload.role);
  });

  it('includes iat and exp in the decoded token', () => {
    const token = generateJWT(payload);
    const decoded = verifyJWT(token);
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp).toBeDefined();
    expect(decoded.exp!).toBeGreaterThan(decoded.iat!);
  });

  it('preserves bot service token fields', () => {
    const botPayload = {
      ...payload,
      botId: 'bot-editorial',
      manuscriptId: 'ms-456',
      permissions: ['read', 'write'],
      type: 'BOT_SERVICE_TOKEN' as const,
    };
    const token = generateJWT(botPayload);
    const decoded = verifyJWT(token);
    expect(decoded.botId).toBe('bot-editorial');
    expect(decoded.manuscriptId).toBe('ms-456');
    expect(decoded.permissions).toEqual(['read', 'write']);
    expect(decoded.type).toBe('BOT_SERVICE_TOKEN');
  });

  it('throws on invalid token', () => {
    expect(() => verifyJWT('invalid.token.here')).toThrow();
  });

  it('throws on tampered token', () => {
    const token = generateJWT(payload);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => verifyJWT(tampered)).toThrow();
  });

  it('throws if JWT_SECRET is not set', () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      expect(() => generateJWT(payload)).toThrow('JWT_SECRET environment variable is required');
      expect(() => verifyJWT('any-token')).toThrow('JWT_SECRET environment variable is required');
    } finally {
      process.env.JWT_SECRET = original;
    }
  });

  it('respects JWT_EXPIRES_IN in days format', () => {
    const original = process.env.JWT_EXPIRES_IN;
    process.env.JWT_EXPIRES_IN = '1d';
    try {
      const token = generateJWT(payload);
      const decoded = verifyJWT(token);
      const expDuration = decoded.exp! - decoded.iat!;
      expect(expDuration).toBe(86400); // 1 day in seconds
    } finally {
      if (original) {
        process.env.JWT_EXPIRES_IN = original;
      } else {
        delete process.env.JWT_EXPIRES_IN;
      }
    }
  });

  it('respects JWT_EXPIRES_IN in seconds format', () => {
    const original = process.env.JWT_EXPIRES_IN;
    process.env.JWT_EXPIRES_IN = '3600';
    try {
      const token = generateJWT(payload);
      const decoded = verifyJWT(token);
      const expDuration = decoded.exp! - decoded.iat!;
      expect(expDuration).toBe(3600);
    } finally {
      if (original) {
        process.env.JWT_EXPIRES_IN = original;
      } else {
        delete process.env.JWT_EXPIRES_IN;
      }
    }
  });

  it('defaults to 7 days expiry', () => {
    const original = process.env.JWT_EXPIRES_IN;
    delete process.env.JWT_EXPIRES_IN;
    process.env.JWT_SECRET = 'test-jwt-secret-for-auth-package-testing-only';
    try {
      const token = generateJWT(payload);
      const decoded = verifyJWT(token);
      const expDuration = decoded.exp! - decoded.iat!;
      expect(expDuration).toBe(7 * 24 * 60 * 60);
    } finally {
      if (original) {
        process.env.JWT_EXPIRES_IN = original;
      } else {
        delete process.env.JWT_EXPIRES_IN;
      }
    }
  });
});

describe('generateSecureToken', () => {
  it('returns a hex string', () => {
    const token = generateSecureToken();
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it('returns a 64-character string (32 bytes)', () => {
    const token = generateSecureToken();
    expect(token).toHaveLength(64);
  });

  it('generates unique tokens', () => {
    const tokens = new Set(Array.from({ length: 10 }, () => generateSecureToken()));
    expect(tokens.size).toBe(10);
  });
});
