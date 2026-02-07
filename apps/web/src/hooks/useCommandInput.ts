'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '@/lib/api';

export interface BotCommand {
  name: string;
  description: string;
  usage: string;
  parameters: BotCommandParameter[];
  examples: string[];
  permissions: string[];
  help?: string;
}

export interface BotCommandParameter {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'enum';
  required: boolean;
  defaultValue?: any;
  enumValues?: string[];
  examples?: string[];
}

export interface CommandSuggestion {
  id: string;
  name: string;
  description: string;
  usage: string;
  botId: string;
  botName: string;
}

export interface ActiveCommandInfo {
  botId: string;
  command: BotCommand | null;
  commandEndPos: number;
  position: { top: number; left: number };
}

interface UseCommandInputProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  value: string;
  onChange: (value: string) => void;
}

interface CommandState {
  isActive: boolean;
  botId: string;
  query: string;
  startPos: number;
  filteredSuggestions: CommandSuggestion[];
  selectedIndex: number;
  position: { top: number; left: number };
}

// ActiveCommandState is exported as ActiveCommandInfo

export function useCommandInput({ textareaRef, containerRef, value, onChange }: UseCommandInputProps) {
  const [commandState, setCommandState] = useState<CommandState>({
    isActive: false,
    botId: '',
    query: '',
    startPos: 0,
    filteredSuggestions: [],
    selectedIndex: 0,
    position: { top: 0, left: 0 }
  });

  const [activeCommand, setActiveCommand] = useState<ActiveCommandInfo | null>(null);
  const [botCommands, setBotCommands] = useState<Record<string, BotCommand[]>>({});
  const [loadingCommands, setLoadingCommands] = useState<Record<string, boolean>>({});

  // Fetch commands for a specific bot
  const fetchBotCommands = useCallback(async (botId: string) => {
    if (botCommands[botId] || loadingCommands[botId]) {
      return botCommands[botId] || [];
    }

    setLoadingCommands(prev => ({ ...prev, [botId]: true }));
    
    try {
      const response = await fetch(`${API_URL}/api/bots/${botId}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const botData = await response.json();
        const commands = botData.commands || [];
        setBotCommands(prev => ({ ...prev, [botId]: commands }));
        return commands;
      }
    } catch (error) {
      console.error(`Error fetching commands for bot ${botId}:`, error);
    } finally {
      setLoadingCommands(prev => ({ ...prev, [botId]: false }));
    }

    return [];
  }, [botCommands, loadingCommands]);

  // Calculate cursor position for suggestion popup (relative to container)
  const calculatePosition = useCallback((textarea: HTMLTextAreaElement, cursorPos: number) => {
    const textBeforeCursor = textarea.value.substring(0, cursorPos);
    const lines = textBeforeCursor.split('\n');
    const currentLine = lines[lines.length - 1];

    // Create a temporary element to measure text width
    const temp = document.createElement('span');
    const computedStyle = window.getComputedStyle(textarea);
    temp.style.font = computedStyle.font;
    temp.style.fontSize = computedStyle.fontSize;
    temp.style.fontFamily = computedStyle.fontFamily;
    temp.style.position = 'absolute';
    temp.style.visibility = 'hidden';
    temp.style.whiteSpace = 'pre';
    temp.style.top = '-9999px';
    temp.style.left = '-9999px';
    temp.textContent = currentLine;
    document.body.appendChild(temp);

    const textWidth = temp.offsetWidth;
    document.body.removeChild(temp);

    const computedLineHeight = parseInt(computedStyle.lineHeight) || parseInt(computedStyle.fontSize) * 1.2 || 20;
    const paddingTop = parseInt(computedStyle.paddingTop) || 0;
    const paddingLeft = parseInt(computedStyle.paddingLeft) || 0;

    // Calculate position relative to the container
    const containerEl = containerRef.current;
    const textareaRect = textarea.getBoundingClientRect();
    const containerRect = containerEl ? containerEl.getBoundingClientRect() : textareaRect;

    const offsetTop = textareaRect.top - containerRect.top;
    const offsetLeft = textareaRect.left - containerRect.left;

    const top = offsetTop + paddingTop + (lines.length - 1) * computedLineHeight + computedLineHeight + 4 - textarea.scrollTop;
    const left = offsetLeft + paddingLeft + textWidth + 8;

    return { top, left };
  }, [containerRef]);

  // Shared detection logic for parameter mode
  const detectParameterMode = useCallback(async (text: string, cursorPos: number) => {
    if (!textareaRef.current) return false;

    const textBeforeCursor = text.substring(0, cursorPos);

    const parameterModeRegex = /@(\w+(?:-\w+)*)\s+(\w+(?:-\w+)*)\s/;
    const paramMatch = textBeforeCursor.match(parameterModeRegex);

    if (paramMatch) {
      const [fullParamMatch, botId, commandName] = paramMatch;
      const commands = await fetchBotCommands(botId);
      const matchedCommand = commands.find((cmd: BotCommand) => cmd.name === commandName);

      if (matchedCommand && matchedCommand.parameters && matchedCommand.parameters.length > 0) {
        const commandEndPos = textBeforeCursor.indexOf(fullParamMatch) + fullParamMatch.length;
        const textAfterCommand = textBeforeCursor.substring(commandEndPos);
        const currentToken = textAfterCommand.split(/\s+/).pop() || '';

        const paramNames = matchedCommand.parameters.map((p: BotCommandParameter) => p.name);
        const looksLikeParam = currentToken === '' ||
          paramNames.some((name: string) => name.startsWith(currentToken)) ||
          paramNames.some((name: string) => currentToken.startsWith(name + '='));

        if (looksLikeParam) {
          const position = calculatePosition(textareaRef.current, cursorPos);
          setActiveCommand({
            botId,
            command: matchedCommand,
            commandEndPos,
            position
          });
          setCommandState(prev => ({ ...prev, isActive: false }));
          return true;
        }
      }
    }

    setActiveCommand(null);
    return false;
  }, [textareaRef, fetchBotCommands, calculatePosition]);

  // Detect bot commands and update state
  const handleTextChange = useCallback(async (newValue: string) => {
    onChange(newValue);

    if (!textareaRef.current) return;

    const cursorPos = textareaRef.current.selectionStart || 0;
    const textBeforeCursor = newValue.substring(0, cursorPos);

    // First, check if we're in parameter entry mode
    const inParamMode = await detectParameterMode(newValue, cursorPos);
    if (inParamMode) return;

    // Look for @bot-id pattern followed by a space and then potential command (autocomplete mode)
    const botMentionRegex = /@(\w+(?:-\w+)*)\s+(\w*)$/;
    const match = textBeforeCursor.match(botMentionRegex);

    if (!match) {
      setCommandState(prev => ({ ...prev, isActive: false }));
      return;
    }

    const [fullMatch, botId, commandQuery] = match;
    const startPos = textBeforeCursor.length - commandQuery.length;

    // Fetch commands for this bot
    const commands = await fetchBotCommands(botId);

    if (!commands.length) {
      setCommandState(prev => ({ ...prev, isActive: false }));
      return;
    }

    // Filter commands based on query
    const filtered: CommandSuggestion[] = commands
      .filter((cmd: BotCommand) =>
        commandQuery === '' ||
        cmd.name.toLowerCase().includes(commandQuery.toLowerCase()) ||
        cmd.description.toLowerCase().includes(commandQuery.toLowerCase())
      )
      .map((cmd: BotCommand) => ({
        id: `${botId}-${cmd.name}`,
        name: cmd.name,
        description: cmd.description,
        usage: cmd.usage,
        botId,
        botName: botId // We could fetch this from bot data if needed
      }));

    // Calculate position for suggestion popup
    const position = calculatePosition(textareaRef.current, cursorPos);

    setCommandState({
      isActive: true,
      botId,
      query: commandQuery,
      startPos,
      filteredSuggestions: filtered,
      selectedIndex: 0,
      position
    });
  }, [onChange, textareaRef, fetchBotCommands, calculatePosition]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!commandState.isActive || commandState.filteredSuggestions.length === 0) return false;
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setCommandState(prev => ({
          ...prev,
          selectedIndex: (prev.selectedIndex + 1) % prev.filteredSuggestions.length
        }));
        return true;
        
      case 'ArrowUp':
        event.preventDefault();
        setCommandState(prev => ({
          ...prev,
          selectedIndex: prev.selectedIndex === 0 
            ? prev.filteredSuggestions.length - 1 
            : prev.selectedIndex - 1
        }));
        return true;
        
      case 'Tab':
      case 'Enter':
        event.preventDefault();
        if (commandState.filteredSuggestions[commandState.selectedIndex]) {
          handleSelectCommand(commandState.filteredSuggestions[commandState.selectedIndex]);
        }
        return true;
        
      case 'Escape':
        event.preventDefault();
        setCommandState(prev => ({ ...prev, isActive: false }));
        return true;
        
      default:
        return false;
    }
  }, [commandState]);

  // Handle command selection
  const handleSelectCommand = useCallback((command: CommandSuggestion) => {
    if (!textareaRef.current) return;

    const beforeCommand = value.substring(0, commandState.startPos);
    const afterCursor = value.substring(textareaRef.current.selectionStart || 0);
    const newValue = `${beforeCommand}${command.name} ${afterCursor}`;

    onChange(newValue);

    // Set cursor position after the command
    const newCursorPos = commandState.startPos + command.name.length + 1; // +1 for space
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);

    setCommandState(prev => ({ ...prev, isActive: false }));

    // Show parameter hints if the selected command has parameters
    const fullCommand = botCommands[command.botId]?.find((cmd: BotCommand) => cmd.name === command.name);
    if (fullCommand && fullCommand.parameters && fullCommand.parameters.length > 0) {
      const position = calculatePosition(textareaRef.current, newCursorPos);
      setActiveCommand({
        botId: command.botId,
        command: fullCommand,
        commandEndPos: commandState.startPos + command.name.length,
        position
      });
    }
  }, [value, commandState.startPos, onChange, textareaRef, botCommands, calculatePosition]);

  // Handle cursor position changes (click, arrow keys)
  const handleCursorChange = useCallback(async () => {
    if (!textareaRef.current) return;
    const cursorPos = textareaRef.current.selectionStart || 0;
    const text = textareaRef.current.value;
    await detectParameterMode(text, cursorPos);
  }, [textareaRef, detectParameterMode]);

  // Close suggestions
  const handleCloseCommands = useCallback(() => {
    setCommandState(prev => ({ ...prev, isActive: false }));
  }, []);

  const clearActiveCommand = useCallback(() => {
    setActiveCommand(null);
  }, []);

  return {
    commandState,
    activeCommand,
    handleTextChange,
    handleKeyDown,
    handleSelectCommand,
    handleCloseCommands,
    handleCursorChange,
    clearActiveCommand,
    isLoadingCommands: loadingCommands[commandState.botId] || false
  };
}