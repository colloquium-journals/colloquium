/**
 * Mock bot utilities for testing bot-related functionality
 */

export interface MockBot {
  id: string;
  name: string;
  description: string;
  isInstalled: boolean;
  isEnabled: boolean;
  color?: string;
}

export const createMockBot = (overrides: Partial<MockBot> = {}): MockBot => ({
  id: 'test-bot',
  name: 'Test Bot',
  description: 'A test bot for testing purposes',
  isInstalled: true,
  isEnabled: true,
  color: 'blue',
  ...overrides,
});

export const mockBots: MockBot[] = [
  {
    id: 'bot-editorial',
    name: 'Editorial Bot',
    description: 'Assists with manuscript editorial workflows',
    isInstalled: true,
    isEnabled: true,
    color: 'blue'
  },
  {
    id: 'bot-plagiarism-checker',
    name: 'Plagiarism Checker',
    description: 'Detects plagiarism in manuscripts',
    isInstalled: true,
    isEnabled: true,
    color: 'green'
  },
  {
    id: 'bot-reference',
    name: 'Reference Bot',
    description: 'Validates references and citations',
    isInstalled: true,
    isEnabled: true,
    color: 'red'
  }
];

export const mockDisabledBot = createMockBot({
  id: 'disabled-bot',
  name: 'Disabled Bot',
  description: 'This bot is disabled',
  isInstalled: true,
  isEnabled: false,
});

export const mockUninstalledBot = createMockBot({
  id: 'uninstalled-bot',
  name: 'Uninstalled Bot',
  description: 'This bot is not installed',
  isInstalled: false,
  isEnabled: true,
});

export const mockBotsApiResponse = {
  bots: mockBots
};

export const mockMixedBotsApiResponse = {
  bots: [...mockBots, mockDisabledBot, mockUninstalledBot]
};

export const mockEmptyBotsApiResponse = {
  bots: []
};

/**
 * Mock fetch response for bots API
 */
export const mockBotsApiCall = (response = mockBotsApiResponse, ok = true, status = 200) => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => response,
  });
};

/**
 * Mock failed authentication response
 */
export const mockAuthFailureApiCall = () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    json: async () => ({
      error: 'Not Authenticated',
      message: 'No authentication token provided'
    }),
  });
};

/**
 * Utility function to get enabled bots (filters installed and enabled)
 */
export const getEnabledBots = (bots: MockBot[]): MockBot[] => {
  return bots.filter(bot => bot.isInstalled && bot.isEnabled);
};

/**
 * Utility to simulate the bot filtering logic from MessageComposer
 */
export const simulateBotFiltering = (apiResponse: { bots: MockBot[] }): MockBot[] => {
  return apiResponse.bots
    .filter((bot: MockBot) => bot.isInstalled && bot.isEnabled)
    .map((bot: MockBot, index: number) => ({
      ...bot,
      color: ['blue', 'green', 'red', 'orange', 'purple', 'cyan', 'pink', 'gray'][index % 8]
    }));
};