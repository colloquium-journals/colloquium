import { MantineTheme, DEFAULT_THEME, mergeMantineTheme } from '@mantine/core';
import { academicTheme } from './theme';

export function createDynamicTheme(
  primaryColor: string = '#1976d2',
  secondaryColor: string = '#424242'
): MantineTheme {
  // Convert hex colors to Mantine color arrays
  const generateColorShades = (baseColor: string): [string, string, string, string, string, string, string, string, string, string] => {
    const baseHex = baseColor.replace('#', '');
    const r = parseInt(baseHex.substr(0, 2), 16);
    const g = parseInt(baseHex.substr(2, 2), 16);
    const b = parseInt(baseHex.substr(4, 2), 16);

    return [
      `rgba(${r}, ${g}, ${b}, 0.1)`,
      `rgba(${r}, ${g}, ${b}, 0.2)`,
      `rgba(${r}, ${g}, ${b}, 0.3)`,
      `rgba(${r}, ${g}, ${b}, 0.4)`,
      `rgba(${r}, ${g}, ${b}, 0.5)`,
      `rgba(${r}, ${g}, ${b}, 0.6)`,
      baseColor,
      `rgba(${Math.max(r-20, 0)}, ${Math.max(g-20, 0)}, ${Math.max(b-20, 0)}, 1)`,
      `rgba(${Math.max(r-40, 0)}, ${Math.max(g-40, 0)}, ${Math.max(b-40, 0)}, 1)`,
      `rgba(${Math.max(r-60, 0)}, ${Math.max(g-60, 0)}, ${Math.max(b-60, 0)}, 1)`
    ];
  };

  const baseTheme = mergeMantineTheme(DEFAULT_THEME, academicTheme);
  const dynamicTheme = mergeMantineTheme(baseTheme, {
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