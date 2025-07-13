'use client';

import { useState, useEffect, useCallback } from 'react';

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

interface UseCommandInputProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
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

export function useCommandInput({ textareaRef, value, onChange }: UseCommandInputProps) {
  const [commandState, setCommandState] = useState<CommandState>({
    isActive: false,
    botId: '',
    query: '',
    startPos: 0,
    filteredSuggestions: [],
    selectedIndex: 0,
    position: { top: 0, left: 0 }
  });

  const [botCommands, setBotCommands] = useState<Record<string, BotCommand[]>>({});
  const [loadingCommands, setLoadingCommands] = useState<Record<string, boolean>>({});

  // Fetch commands for a specific bot
  const fetchBotCommands = useCallback(async (botId: string) => {
    if (botCommands[botId] || loadingCommands[botId]) {
      return botCommands[botId] || [];
    }

    setLoadingCommands(prev => ({ ...prev, [botId]: true }));
    
    try {
      const response = await fetch(`http://localhost:4000/api/bots/${botId}`, {
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

  // Calculate cursor position for suggestion popup
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
    
    const rect = textarea.getBoundingClientRect();
    const lineHeight = parseInt(computedStyle.lineHeight) || parseInt(computedStyle.fontSize) * 1.2 || 20;
    
    // Account for textarea padding
    const paddingTop = parseInt(computedStyle.paddingTop) || 0;
    const paddingLeft = parseInt(computedStyle.paddingLeft) || 0;
    
    // Calculate position relative to viewport
    const top = rect.top + paddingTop + (lines.length - 1) * lineHeight + lineHeight + 4;
    const left = rect.left + paddingLeft + textWidth + 8;
    
    return { top, left };
  }, []);

  // Detect bot commands and update state
  const handleTextChange = useCallback(async (newValue: string) => {
    onChange(newValue);
    
    if (!textareaRef.current) return;
    
    const cursorPos = textareaRef.current.selectionStart || 0;
    const textBeforeCursor = newValue.substring(0, cursorPos);
    
    // Look for @bot-id pattern followed by a space and then potential command
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
  }, [value, commandState.startPos, onChange, textareaRef]);

  // Close suggestions
  const handleCloseCommands = useCallback(() => {
    setCommandState(prev => ({ ...prev, isActive: false }));
  }, []);

  return {
    commandState,
    handleTextChange,
    handleKeyDown,
    handleSelectCommand,
    handleCloseCommands,
    isLoadingCommands: loadingCommands[commandState.botId] || false
  };
}