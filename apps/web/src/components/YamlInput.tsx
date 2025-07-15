'use client';

import { forwardRef } from 'react';
import { Textarea, TextareaProps } from '@mantine/core';
import * as yaml from 'js-yaml';

interface YamlInputProps extends Omit<TextareaProps, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  validationError?: string;
}

export const YamlInput = forwardRef<HTMLTextAreaElement, YamlInputProps>(
  ({ value, onChange, validationError, error, ...props }, ref) => {
    // Validate YAML on change
    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = event.target.value;
      onChange(newValue);
    };

    // Check if current value is valid YAML
    const isValidYaml = (yamlString: string): boolean => {
      if (!yamlString.trim()) return true; // Empty string is valid
      try {
        yaml.load(yamlString);
        return true;
      } catch {
        return false;
      }
    };

    // Determine error message
    const getErrorMessage = (): string | undefined => {
      if (error) return typeof error === 'string' ? error : 'Invalid input';
      if (validationError && value && !isValidYaml(value)) {
        return validationError;
      }
      return undefined;
    };

    return (
      <Textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        error={getErrorMessage()}
        styles={{
          input: {
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            fontSize: '14px',
            lineHeight: '1.5',
            ...(typeof props.styles === 'object' ? props.styles?.input : {})
          }
        }}
        {...props}
      />
    );
  }
);

YamlInput.displayName = 'YamlInput';