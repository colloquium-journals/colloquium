'use client';

import { forwardRef, useState, useRef, useEffect } from 'react';
import { Textarea, TextareaProps, Box, useMantineTheme } from '@mantine/core';
import * as yaml from 'js-yaml';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vs, vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface YamlInputProps extends Omit<TextareaProps, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  validationError?: string;
}

export const YamlInput = forwardRef<HTMLTextAreaElement, YamlInputProps>(
  ({ value, onChange, validationError, error, ...props }, ref) => {
    const theme = useMantineTheme();
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const highlightRef = useRef<HTMLDivElement>(null);

    // Combine refs
    useEffect(() => {
      if (ref) {
        if (typeof ref === 'function') {
          ref(textareaRef.current);
        } else {
          ref.current = textareaRef.current;
        }
      }
    }, [ref]);

    // Validate YAML on change
    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = event.target.value;
      onChange(newValue);
    };

    // Handle focus/blur for syntax highlighting
    const handleFocus = (event: React.FocusEvent<HTMLTextAreaElement>) => {
      setIsFocused(true);
      props.onFocus?.(event);
    };

    const handleBlur = (event: React.FocusEvent<HTMLTextAreaElement>) => {
      setIsFocused(false);
      props.onBlur?.(event);
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

    // Sync scroll between textarea and highlight
    const handleScroll = () => {
      if (textareaRef.current && highlightRef.current) {
        highlightRef.current.scrollTop = textareaRef.current.scrollTop;
        highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
      }
    };

    const isDarkTheme = theme.colorScheme === 'dark';
    const syntaxStyle = isDarkTheme ? vscDarkPlus : vs;

    return (
      <Box style={{ position: 'relative' }}>
        {/* Syntax highlighting overlay - only show when not focused */}
        {!isFocused && value && (
          <Box
            ref={highlightRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'none',
              overflow: 'hidden',
              border: `1px solid ${theme.colors.gray[3]}`,
              borderRadius: theme.radius.sm,
              zIndex: 1
            }}
          >
            <SyntaxHighlighter
              language="yaml"
              style={syntaxStyle}
              customStyle={{
                margin: 0,
                padding: '12px',
                background: 'transparent',
                fontSize: '14px',
                lineHeight: '1.5',
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                border: 'none',
                overflow: 'visible'
              }}
              codeTagProps={{
                style: {
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                  fontSize: '14px',
                  lineHeight: '1.5'
                }
              }}
            >
              {value}
            </SyntaxHighlighter>
          </Box>
        )}

        {/* Actual textarea for editing */}
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onScroll={handleScroll}
          error={getErrorMessage()}
          styles={{
            input: {
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
              fontSize: '14px',
              lineHeight: '1.5',
              backgroundColor: isFocused ? undefined : 'transparent',
              color: isFocused ? undefined : 'transparent',
              caretColor: 'auto',
              position: 'relative',
              zIndex: 2,
              ...(typeof props.styles === 'object' ? props.styles?.input : {})
            }
          }}
          {...props}
        />
      </Box>
    );
  }
);

YamlInput.displayName = 'YamlInput';