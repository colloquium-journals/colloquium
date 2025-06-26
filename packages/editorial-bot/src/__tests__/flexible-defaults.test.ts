/**
 * Tests demonstrating the flexible default value system.
 * This shows how developers can easily modify default behavior.
 */

// Note: In a real implementation, you would import and modify the defaultProviders
// For testing purposes, we'll create a mock version to demonstrate the concept

type DefaultValueProvider<T> = {
  value?: T;
  generate?: () => T;
  enabled?: boolean;
};

function getDefaultValue<T>(provider: DefaultValueProvider<T>): T | undefined {
  if (provider.enabled === false) return undefined;
  if (provider.value !== undefined) return provider.value;
  if (provider.generate) return provider.generate();
  return undefined;
}

describe('Flexible Default System', () => {
  describe('getDefaultValue function', () => {
    it('should return undefined when enabled is false', () => {
      const provider: DefaultValueProvider<string> = {
        enabled: false,
        value: 'test-value'
      };
      
      expect(getDefaultValue(provider)).toBeUndefined();
    });

    it('should return static value when provided', () => {
      const provider: DefaultValueProvider<string> = {
        enabled: true,
        value: 'static-deadline'
      };
      
      expect(getDefaultValue(provider)).toBe('static-deadline');
    });

    it('should call generate function when no static value', () => {
      const mockGenerate = jest.fn(() => '2024-03-15');
      const provider: DefaultValueProvider<string> = {
        enabled: true,
        generate: mockGenerate
      };
      
      const result = getDefaultValue(provider);
      expect(result).toBe('2024-03-15');
      expect(mockGenerate).toHaveBeenCalledTimes(1);
    });

    it('should prefer static value over generate function', () => {
      const mockGenerate = jest.fn(() => 'generated-value');
      const provider: DefaultValueProvider<string> = {
        enabled: true,
        value: 'static-value',
        generate: mockGenerate
      };
      
      const result = getDefaultValue(provider);
      expect(result).toBe('static-value');
      expect(mockGenerate).not.toHaveBeenCalled();
    });

    it('should default to enabled when enabled is undefined', () => {
      const provider: DefaultValueProvider<string> = {
        value: 'test-value'
      };
      
      expect(getDefaultValue(provider)).toBe('test-value');
    });
  });

  describe('Example deadline providers', () => {
    it('should demonstrate no default deadline (current behavior)', () => {
      const deadlineProvider: DefaultValueProvider<string> = {
        enabled: false,
        generate: () => {
          const date = new Date();
          date.setDate(date.getDate() + 30);
          return date.toISOString().split('T')[0];
        }
      };

      expect(getDefaultValue(deadlineProvider)).toBeUndefined();
    });

    it('should demonstrate 30-day default deadline (if enabled)', () => {
      const deadlineProvider: DefaultValueProvider<string> = {
        enabled: true,
        generate: () => {
          const date = new Date('2024-01-01'); // Fixed date for testing
          date.setDate(date.getDate() + 30);
          return date.toISOString().split('T')[0];
        }
      };

      expect(getDefaultValue(deadlineProvider)).toBe('2024-01-31');
    });

    it('should demonstrate custom static deadline', () => {
      const deadlineProvider: DefaultValueProvider<string> = {
        enabled: true,
        value: '2024-12-31'
      };

      expect(getDefaultValue(deadlineProvider)).toBe('2024-12-31');
    });

    it('should demonstrate conditional deadline based on manuscript type', () => {
      const manuscriptType = 'urgent';
      const deadlineProvider: DefaultValueProvider<string> = {
        enabled: true,
        generate: () => {
          const date = new Date('2024-01-01');
          const daysToAdd = manuscriptType === 'urgent' ? 14 : 30;
          date.setDate(date.getDate() + daysToAdd);
          return date.toISOString().split('T')[0];
        }
      };

      expect(getDefaultValue(deadlineProvider)).toBe('2024-01-15'); // 14 days for urgent
    });
  });

  describe('Developer-friendly modification examples', () => {
    it('should show how to enable 30-day deadline default', () => {
      // Example of how a developer would modify the defaults
      const originalProvider = {
        enabled: false,
        generate: () => {
          const date = new Date();
          date.setDate(date.getDate() + 30);
          return date.toISOString().split('T')[0];
        }
      };

      // To enable: simply set enabled to true
      const modifiedProvider = { ...originalProvider, enabled: true };
      
      // Now it will generate a default
      expect(getDefaultValue(modifiedProvider)).toBeDefined();
      expect(typeof getDefaultValue(modifiedProvider)).toBe('string');
    });

    it('should show how to set a custom default period', () => {
      // Example: 21-day default instead of 30
      const customProvider: DefaultValueProvider<string> = {
        enabled: true,
        generate: () => {
          const date = new Date('2024-01-01');
          date.setDate(date.getDate() + 21); // Custom period
          return date.toISOString().split('T')[0];
        }
      };

      expect(getDefaultValue(customProvider)).toBe('2024-01-22');
    });

    it('should show how to use environment-based defaults', () => {
      // Example: different defaults for different environments
      const envProvider: DefaultValueProvider<string> = {
        enabled: true,
        generate: () => {
          const environment = process.env.NODE_ENV || 'development';
          const date = new Date('2024-01-01');
          
          // Shorter deadlines in test/development for testing
          const daysToAdd = environment === 'test' || environment === 'development' ? 7 : 30;
          date.setDate(date.getDate() + daysToAdd);
          return date.toISOString().split('T')[0];
        }
      };

      expect(getDefaultValue(envProvider)).toBe('2024-01-08'); // 7 days in test env
    });
  });
});