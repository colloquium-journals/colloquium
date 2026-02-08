'use client';

import { useState, useEffect, useRef, type Ref } from 'react';
import { Box, Text, useMantineTheme } from '@mantine/core';
import * as yaml from 'js-yaml';
import Editor from '@monaco-editor/react';

interface YamlInputProps {
  value: string;
  onChange: (value: string) => void;
  validationError?: string;
  error?: string | boolean;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  disabled?: boolean;
  label?: string;
  description?: string;
  required?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  style?: React.CSSProperties;
  styles?: any;
  className?: string;
}

export function YamlInput({
    value,
    onChange,
    validationError,
    error,
    placeholder,
    minRows = 4,
    maxRows = 20,
    disabled = false,
    label,
    description,
    required = false,
    onFocus,
    onBlur,
    style,
    styles,
    className,
    ref,
    ...props
  }: YamlInputProps & { ref?: Ref<HTMLDivElement> }) {
    const theme = useMantineTheme();
    const [editorHeight, setEditorHeight] = useState(minRows * 20);
    const editorRef = useRef<any>(null);

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

    // Calculate editor height based on content
    useEffect(() => {
      if (value) {
        const lines = value.split('\n').length;
        const calculatedHeight = Math.max(
          minRows * 20,
          Math.min(maxRows * 20, lines * 20)
        );
        setEditorHeight(calculatedHeight);
      }
    }, [value, minRows, maxRows]);

    // Handle editor mount
    const handleEditorDidMount = (editor: any) => {
      editorRef.current = editor;
      
      // Configure editor behavior
      editor.onDidChangeModelContent(() => {
        // Editor content change handling can be added here if needed
      });
    };

    const isDarkTheme = theme.other?.colorScheme === 'dark';
    const errorMessage = getErrorMessage();

    return (
      <Box ref={ref} style={style} className={className} {...props}>
        {label && (
          <Text size="sm" fw={500} mb={4}>
            {label}
            {required && <Text component="span" c="red"> *</Text>}
          </Text>
        )}
        
        {description && (
          <Text size="xs" c="dimmed" mb={8}>
            {description}
          </Text>
        )}

        <Box
          style={{
            border: `1px solid ${errorMessage ? theme.colors.red[6] : theme.colors.gray[4]}`,
            borderRadius: theme.radius.sm,
            overflow: 'hidden'
          }}
        >
          <Editor
            height={editorHeight}
            language="yaml"
            theme={isDarkTheme ? 'vs-dark' : 'vs-light'}
            value={value}
            onChange={(newValue) => onChange(newValue || '')}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 14,
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
              lineNumbers: 'on',
              glyphMargin: false,
              folding: true,
              lineDecorationsWidth: 0,
              lineNumbersMinChars: 3,
              renderLineHighlight: 'gutter',
              selectOnLineNumbers: true,
              roundedSelection: false,
              readOnly: disabled,
              cursorStyle: 'line',
              automaticLayout: true,
              wordWrap: 'on',
              wrappingIndent: 'indent',
              tabSize: 2,
              insertSpaces: true,
              scrollbar: {
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 10
              },
              overviewRulerBorder: false,
              hideCursorInOverviewRuler: true,
              contextmenu: true,
              mouseWheelZoom: false,
              links: false,
              colorDecorators: false,
              dragAndDrop: false,
              suggestOnTriggerCharacters: false,
              acceptSuggestionOnEnter: 'off',
              quickSuggestions: false,
              parameterHints: { enabled: false },
              hover: { enabled: false }
            }}
          />
        </Box>

        {errorMessage && (
          <Text size="xs" c="red" mt={4}>
            {errorMessage}
          </Text>
        )}
      </Box>
    );
  }