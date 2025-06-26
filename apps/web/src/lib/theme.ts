import { createTheme, DEFAULT_THEME } from '@mantine/core';

export const academicTheme = createTheme({
  colors: {
    academic: [
      '#f8f9fa', // Light gray for backgrounds
      '#e9ecef', // Subtle borders
      '#dee2e6', // Disabled states
      '#ced4da', // Placeholder text
      '#adb5bd', // Secondary text
      '#6c757d', // Tertiary text
      '#495057', // Body text
      '#343a40', // Headings
      '#212529', // Dark text
      '#000000', // Pure black
    ],
    // Status colors for manuscript workflow
    submitted: ['#e3f2fd', '#bbdefb', '#90caf9', '#64b5f6', '#42a5f5', '#2196f3', '#1e88e5', '#1976d2', '#1565c0', '#0d47a1'],
    review: ['#fff3e0', '#ffe0b2', '#ffcc02', '#ffb74d', '#ffa726', '#ff9800', '#fb8c00', '#f57c00', '#ef6c00', '#e65100'],
    accepted: ['#e8f5e8', '#c8e6c8', '#a5d6a7', '#81c784', '#66bb6a', '#4caf50', '#43a047', '#388e3c', '#2e7d32', '#1b5e20'],
    rejected: ['#ffebee', '#ffcdd2', '#ef9a9a', '#e57373', '#ef5350', '#f44336', '#e53935', '#d32f2f', '#c62828', '#b71c1c']
  },
  primaryColor: 'academic',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  headings: { 
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
    sizes: {
      h1: { fontSize: '2rem', fontWeight: '700' },
      h2: { fontSize: '1.5rem', fontWeight: '600' },
      h3: { fontSize: '1.25rem', fontWeight: '600' },
    }
  },
  components: {
    Card: {
      defaultProps: {
        shadow: 'sm',
        padding: 'lg',
        radius: 'md'
      }
    },
    Button: {
      defaultProps: {
        radius: 'md'
      }
    },
    TextInput: {
      defaultProps: {
        radius: 'md'
      }
    }
  }
});