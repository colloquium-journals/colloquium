'use client';

import { useState, useEffect } from 'react';
import { Checkbox } from '@mantine/core';
// API utility functions
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface InteractiveCheckboxProps {
  messageId: string;
  checkboxId: string;
  label: string;
  initialChecked?: boolean;
  disabled?: boolean;
  required?: boolean;
  onStateChange?: (checked: boolean) => void;
}

export function InteractiveCheckbox({ 
  messageId, 
  checkboxId, 
  label, 
  initialChecked = false,
  disabled = false,
  required = false,
  onStateChange 
}: InteractiveCheckboxProps) {
  const [checked, setChecked] = useState(initialChecked);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update local state when initialChecked changes
  useEffect(() => {
    setChecked(initialChecked);
  }, [initialChecked]);

  const handleToggle = async (newChecked: boolean) => {
    if (disabled || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/messages/${messageId}/checkbox-states`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          checkboxId,
          checked: newChecked
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setChecked(newChecked);
          onStateChange?.(newChecked);
        } else {
          throw new Error('Failed to update checkbox state');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      console.error('Error updating checkbox state:', err);
      setError('Failed to save checkbox state');
      // Revert the change
      setChecked(!newChecked);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <Checkbox
        checked={checked}
        onChange={(event) => handleToggle(event.currentTarget.checked)}
        label={
          <span>
            {label}
            {required && <span style={{ color: 'red', marginLeft: '4px' }}>*</span>}
            {loading && <span style={{ color: 'gray', marginLeft: '8px', fontSize: '12px' }}>saving...</span>}
          </span>
        }
        disabled={disabled || loading}
        error={error}
        size="sm"
        styles={{
          label: {
            fontSize: '14px',
            lineHeight: 1.4,
            cursor: disabled ? 'default' : 'pointer'
          },
          input: {
            cursor: disabled ? 'default' : 'pointer'
          }
        }}
      />
      {error && (
        <div style={{ 
          fontSize: '12px', 
          color: 'red', 
          marginTop: '2px',
          marginLeft: '24px' 
        }}>
          {error}
        </div>
      )}
    </div>
  );
}