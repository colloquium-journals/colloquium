'use client';

import { useState, useEffect } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export interface CheckboxState {
  checked: boolean;
  updatedAt: Date;
}

export interface CheckboxStates {
  [messageId: string]: {
    [checkboxId: string]: CheckboxState;
  };
}

export function useCheckboxStates(messageIds: string[]) {
  const [checkboxStates, setCheckboxStates] = useState<CheckboxStates>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch checkbox states for given message IDs
  useEffect(() => {
    if (messageIds.length === 0) {
      setCheckboxStates({});
      return;
    }

    const fetchCheckboxStates = async () => {
      setLoading(true);
      setError(null);

      try {
        const messageIdsParam = messageIds.join(',');
        const response = await fetch(`${API_BASE_URL}/checkbox-states?messageIds=${messageIdsParam}`, {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setCheckboxStates(data.checkboxStates || {});
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (err) {
        console.error('Error fetching checkbox states:', err);
        setError('Failed to load checkbox states');
      } finally {
        setLoading(false);
      }
    };

    fetchCheckboxStates();
  }, [messageIds.join(',')]); // Depend on serialized message IDs

  // Update a specific checkbox state locally (optimistic update)
  const updateCheckboxState = (messageId: string, checkboxId: string, checked: boolean) => {
    setCheckboxStates(prev => ({
      ...prev,
      [messageId]: {
        ...prev[messageId],
        [checkboxId]: {
          checked,
          updatedAt: new Date()
        }
      }
    }));
  };

  // Get checkbox state for a specific message and checkbox
  const getCheckboxState = (messageId: string, checkboxId: string): CheckboxState | null => {
    return checkboxStates[messageId]?.[checkboxId] || null;
  };

  // Check if a checkbox is checked
  const isChecked = (messageId: string, checkboxId: string): boolean => {
    return checkboxStates[messageId]?.[checkboxId]?.checked || false;
  };

  return {
    checkboxStates,
    loading,
    error,
    updateCheckboxState,
    getCheckboxState,
    isChecked
  };
}