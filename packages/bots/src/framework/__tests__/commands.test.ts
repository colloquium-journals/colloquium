import { CommandParser, type CommandBot, type BotCommand } from '../commands';

describe('CommandParser', () => {
  let parser: CommandParser;
  let mockBot: CommandBot;

  beforeEach(() => {
    parser = new CommandParser();
    
    // Create a mock bot for testing
    const helpCommand: BotCommand = {
      name: 'help',
      description: 'Show help information',
      usage: '@test help',
      parameters: [],
      examples: ['@test help'],
      permissions: [],
      async execute() {
        return { messages: [{ content: 'Help message' }] };
      }
    };

    const statusCommand: BotCommand = {
      name: 'status',
      description: 'Update status',
      usage: '@test status <newStatus>',
      parameters: [
        {
          name: 'newStatus',
          description: 'The new status',
          type: 'enum',
          required: true,
          enumValues: ['SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED'],
          examples: ['UNDER_REVIEW']
        }
      ],
      examples: ['@test status UNDER_REVIEW'],
      permissions: ['update_status'],
      async execute() {
        return { messages: [{ content: 'Status updated' }] };
      }
    };

    mockBot = {
      id: 'test-bot',
      name: 'Test Bot',
      description: 'A test bot',
      version: '1.0.0',
      commands: [helpCommand, statusCommand],
      keywords: ['test'],
      triggers: [],
      permissions: ['update_status'],
      help: {
        overview: 'Test bot overview',
        quickStart: 'Use @test help',
        examples: ['@test help']
      }
    };

    parser.registerBot(mockBot);
  });

  describe('parseMessage', () => {
    it('should parse simple bot mention with command', () => {
      const result = parser.parseMessage('@test help');
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        botId: 'test-bot',
        command: 'help',
        parameters: {},
        rawText: '@test help'
      });
    });

    it('should handle simple bot mention without command by triggering help', () => {
      const result = parser.parseMessage('@test-bot');
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        botId: 'test-bot',
        command: 'help',
        parameters: {},
        rawText: '@test-bot'
      });
    });

    it('should handle simple bot mention by bot name without command', () => {
      const result = parser.parseMessage('@test');
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        botId: 'test-bot',
        command: 'help',
        parameters: {},
        rawText: '@test'
      });
    });

    it('should not double-process bot mentions that already have commands', () => {
      const result = parser.parseMessage('@test help');
      // Should only process once, not as both command mention and simple mention
      expect(result).toHaveLength(1);
      expect(result[0].command).toBe('help');
    });

    it('should parse bot mention with command and parameters', () => {
      const result = parser.parseMessage('@test status UNDER_REVIEW');
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        botId: 'test-bot',
        command: 'status',
        parameters: { newStatus: 'UNDER_REVIEW' },
        rawText: '@test status UNDER_REVIEW'
      });
    });

    it('should handle unrecognized commands', () => {
      const result = parser.parseMessage('@test unknown');
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        botId: 'test-bot',
        command: 'unknown',
        parameters: { originalText: '' },
        rawText: '@test unknown',
        isUnrecognized: true
      });
    });

    it('should handle unrecognized bot names', () => {
      const result = parser.parseMessage('@unknown-bot help');
      
      expect(result).toHaveLength(0);
    });

    it('should parse multiple bot mentions in one message', () => {
      const result = parser.parseMessage('@test help @test status ACCEPTED');
      
      expect(result).toHaveLength(2);
      expect(result[0].command).toBe('help');
      expect(result[1].command).toBe('status');
      expect(result[1].parameters.newStatus).toBe('ACCEPTED');
    });

    it('should handle messages without bot mentions', () => {
      const result = parser.parseMessage('This is just a regular message');
      
      expect(result).toHaveLength(0);
    });
  });

  describe('findBotByName', () => {
    it('should find bot by exact ID', () => {
      const debug = parser.debugFindBot('test-bot');
      expect(debug.found).toBe(true);
      expect(debug.botId).toBe('test-bot');
    });

    it('should find bot by first word of name', () => {
      const debug = parser.debugFindBot('test');
      expect(debug.found).toBe(true);
      expect(debug.botId).toBe('test-bot');
    });

    it('should not find non-existent bot', () => {
      const debug = parser.debugFindBot('nonexistent');
      expect(debug.found).toBe(false);
    });
  });

  describe('validateParameters', () => {
    it('should validate required parameters', () => {
      const statusCommand = mockBot.commands.find(cmd => cmd.name === 'status')!;
      
      const validation = parser.validateParameters({}, statusCommand);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain("Required parameter 'newStatus' is missing");
    });

    it('should validate enum parameters', () => {
      const statusCommand = mockBot.commands.find(cmd => cmd.name === 'status')!;
      
      const validation = parser.validateParameters({ newStatus: 'INVALID_STATUS' }, statusCommand);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain("Parameter 'newStatus' must be one of: SUBMITTED, UNDER_REVIEW, ACCEPTED");
    });

    it('should pass validation for valid parameters', () => {
      const statusCommand = mockBot.commands.find(cmd => cmd.name === 'status')!;
      
      const validation = parser.validateParameters({ newStatus: 'UNDER_REVIEW' }, statusCommand);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });
});