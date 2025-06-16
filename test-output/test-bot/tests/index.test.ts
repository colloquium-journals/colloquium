import { TestBotBot, manifest } from '../src/index';
import { BotContext } from '@colloquium/types';

describe('Test Bot Bot', () => {
  const mockContext: BotContext = {
    conversationId: 'test-conversation',
    manuscriptId: 'test-manuscript',
    triggeredBy: {
      messageId: 'test-message',
      userId: 'test-user',
      trigger: 'mention' as any
    },
    journal: {
      id: 'test-journal',
      settings: {}
    },
    config: {
      defaultMode: 'standard',
      enableNotifications: true
    }
  };

  describe('Bot Metadata', () => {
    test('should have correct bot ID and name', () => {
      expect(TestBotBot.id).toBe('test-bot');
      expect(TestBotBot.name).toBe('Test Bot');
      expect(TestBotBot.version).toBe('1.0.0');
    });

    test('should have required commands', () => {
      expect(TestBotBot.commands).toHaveLength(2);
      
      const commandNames = TestBotBot.commands.map(cmd => cmd.name);
      expect(commandNames).toContain('analyze');
      expect(commandNames).toContain('help');
    });

    test('should have correct permissions', () => {
      expect(TestBotBot.permissions).toContain('read_manuscript');
    });

    test('should have proper help configuration', () => {
      expect(TestBotBot.help.overview).toBeDefined();
      expect(TestBotBot.help.quickStart).toBeDefined();
      expect(TestBotBot.help.examples).toBeInstanceOf(Array);
      expect(TestBotBot.help.examples.length).toBeGreaterThan(0);
    });
  });

  describe('Analyze Command', () => {
    const analyzeCommand = TestBotBot.commands.find(cmd => cmd.name === 'analyze');

    test('should exist and have correct metadata', () => {
      expect(analyzeCommand).toBeDefined();
      expect(analyzeCommand?.description).toContain('manuscript');
      expect(analyzeCommand?.permissions).toContain('read_manuscript');
      expect(analyzeCommand?.parameters).toHaveLength(2);
    });

    test('should have mode parameter', () => {
      const modeParam = analyzeCommand?.parameters.find(p => p.name === 'mode');
      expect(modeParam).toBeDefined();
      expect(modeParam?.type).toBe('enum');
      expect(modeParam?.defaultValue).toBe('standard');
      expect(modeParam?.required).toBe(false);
    });

    test('should have includeMetadata parameter', () => {
      const metadataParam = analyzeCommand?.parameters.find(p => p.name === 'includeMetadata');
      expect(metadataParam).toBeDefined();
      expect(metadataParam?.type).toBe('boolean');
      expect(metadataParam?.defaultValue).toBe(false);
    });

    test('should execute successfully with default parameters', async () => {
      if (analyzeCommand) {
        const result = await analyzeCommand.execute({
          mode: 'standard',
          includeMetadata: false
        }, mockContext);
        
        expect(result.messages).toBeDefined();
        expect(result.messages).toHaveLength(1);
        expect(result.messages![0].content).toContain('Test Bot Analysis');
        expect(result.messages![0].content).toContain('test-manuscript');
        expect(result.messages![0].attachments).toBeDefined();
        expect(result.messages![0].attachments).toHaveLength(1);
        expect(result.messages![0].attachments![0].filename).toContain('test-bot-analysis');
      }
    });

    test('should execute with detailed mode', async () => {
      if (analyzeCommand) {
        const result = await analyzeCommand.execute({
          mode: 'detailed',
          includeMetadata: true
        }, mockContext);
        
        expect(result.messages).toBeDefined();
        expect(result.messages![0].content).toContain('detailed');
        
        // Parse the JSON attachment to verify metadata is included
        const attachment = result.messages![0].attachments![0];
        const reportData = JSON.parse(attachment.data);
        expect(reportData.mode).toBe('detailed');
        expect(reportData.includeMetadata).toBe(true);
        expect(reportData.metadata).toBeDefined();
      }
    });

    test('should execute with basic mode', async () => {
      if (analyzeCommand) {
        const result = await analyzeCommand.execute({
          mode: 'basic',
          includeMetadata: false
        }, mockContext);
        
        expect(result.messages).toBeDefined();
        expect(result.messages![0].content).toContain('basic');
      }
    });

    test('should include different sections in response', async () => {
      if (analyzeCommand) {
        const result = await analyzeCommand.execute({
          mode: 'standard',
          includeMetadata: false
        }, mockContext);
        
        const content = result.messages![0].content;
        expect(content).toContain('Results Summary');
        expect(content).toContain('Recommendations');
        expect(content).toContain('Items analyzed');
        expect(content).toContain('Issues found');
        expect(content).toContain('Confidence score');
      }
    });
  });

  describe('Help Command', () => {
    const helpCommand = TestBotBot.commands.find(cmd => cmd.name === 'help');

    test('should exist and have correct metadata', () => {
      expect(helpCommand).toBeDefined();
      expect(helpCommand?.description).toContain('help');
      expect(helpCommand?.parameters).toHaveLength(0);
      expect(helpCommand?.permissions).toHaveLength(0);
    });

    test('should execute successfully', async () => {
      if (helpCommand) {
        const result = await helpCommand.execute({}, mockContext);
        
        expect(result.messages).toBeDefined();
        expect(result.messages).toHaveLength(1);
        expect(result.messages![0].content).toContain('Test Bot Help');
        expect(result.messages![0].content).toContain('Available Commands');
        expect(result.messages![0].content).toContain('Usage Examples');
      }
    });

    test('should include bot description and usage info', async () => {
      if (helpCommand) {
        const result = await helpCommand.execute({}, mockContext);
        
        const content = result.messages![0].content;
        expect(content).toContain('A Colloquium bot for Test Bot functionality');
        expect(content).toContain('analyze');
        expect(content).toContain('Analysis Modes');
        expect(content).toContain('@test-bot');
      }
    });
  });

  describe('Plugin Manifest', () => {
    test('should have correct package information', () => {
      expect(manifest.name).toBe('@myorg/test-bot');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.description).toBe('A Colloquium bot for Test Bot functionality');
      expect(manifest.author.name).toBe('Your Name');
      expect(manifest.license).toBe('MIT');
    });

    test('should have colloquium-specific configuration', () => {
      expect(manifest.colloquium.botId).toBe('test-bot');
      expect(manifest.colloquium.apiVersion).toBe('1.0.0');
      expect(manifest.colloquium.category).toBe('utility');
      expect(manifest.colloquium.permissions).toContain('read_manuscript');
      expect(manifest.colloquium.isDefault).toBe(false);
    });

    test('should have default configuration', () => {
      expect(manifest.colloquium.defaultConfig).toBeDefined();
      expect(manifest.colloquium.defaultConfig.defaultMode).toBe('standard');
      expect(manifest.colloquium.defaultConfig.enableNotifications).toBe(true);
      expect(manifest.colloquium.defaultConfig.includeMetadataByDefault).toBe(false);
    });

    test('should have keywords', () => {
      expect(manifest.keywords).toBeInstanceOf(Array);
      expect(manifest.keywords.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle errors gracefully in analyze command', async () => {
      const analyzeCommand = TestBotBot.commands.find(cmd => cmd.name === 'analyze');
      
      if (analyzeCommand) {
        // Mock context that might cause an error
        const errorContext = {
          ...mockContext,
          manuscriptId: '' // Invalid manuscript ID
        };
        
        const result = await analyzeCommand.execute({
          mode: 'standard',
          includeMetadata: false
        }, errorContext);
        
        // Should not throw, but return error message
        expect(result.messages).toBeDefined();
        expect(result.messages).toHaveLength(1);
        
        // Error responses should still be helpful
        const content = result.messages![0].content;
        expect(content).toContain('Error') || expect(content).toContain('error');
      }
    });
  });

  describe('Performance', () => {
    test('should complete analysis within reasonable time', async () => {
      const analyzeCommand = TestBotBot.commands.find(cmd => cmd.name === 'analyze');
      
      if (analyzeCommand) {
        const startTime = Date.now();
        
        await analyzeCommand.execute({
          mode: 'basic',
          includeMetadata: false
        }, mockContext);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Should complete basic analysis within 2 seconds
        expect(duration).toBeLessThan(2000);
      }
    });
  });
});