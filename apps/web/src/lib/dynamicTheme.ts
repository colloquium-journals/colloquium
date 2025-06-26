import { MantineTheme, DEFAULT_THEME, mergeMantineTheme } from '@mantine/core';
import { academicTheme } from './theme';

export function createDynamicTheme(
  primaryColor: string = '#1976d2',
  secondaryColor: string = '#424242'
): MantineTheme {
  // Convert hex colors to Mantine color arrays
  const generateColorShades = (baseColor: string) => {
    // This is a simplified version - in production you'd want a proper color shade generator
    const baseHex = baseColor.replace('#', '');
    const r = parseInt(baseHex.substr(0, 2), 16);
    const g = parseInt(baseHex.substr(2, 2), 16);
    const b = parseInt(baseHex.substr(4, 2), 16);
    
    return [
      `rgba(${r}, ${g}, ${b}, 0.1)`,  // 0 - lightest
      `rgba(${r}, ${g}, ${b}, 0.2)`,  // 1
      `rgba(${r}, ${g}, ${b}, 0.3)`,  // 2
      `rgba(${r}, ${g}, ${b}, 0.4)`,  // 3
      `rgba(${r}, ${g}, ${b}, 0.5)`,  // 4
      `rgba(${r}, ${g}, ${b}, 0.6)`,  // 5
      baseColor,                       // 6 - base color
      `rgba(${Math.max(r-20, 0)}, ${Math.max(g-20, 0)}, ${Math.max(b-20, 0)}, 1)`, // 7
      `rgba(${Math.max(r-40, 0)}, ${Math.max(g-40, 0)}, ${Math.max(b-40, 0)}, 1)`, // 8
      `rgba(${Math.max(r-60, 0)}, ${Math.max(g-60, 0)}, ${Math.max(b-60, 0)}, 1)`  // 9 - darkest
    ];
  };

  const dynamicTheme = mergeMantineTheme(academicTheme, {
    colors: {
      ...academicTheme.colors,
      primary: generateColorShades(primaryColor),
      secondary: generateColorShades(secondaryColor),
    },
    primaryColor: 'primary',
    other: {
      journalPrimaryColor: primaryColor,
      journalSecondaryColor: secondaryColor,
    }
  });

  return dynamicTheme;
}