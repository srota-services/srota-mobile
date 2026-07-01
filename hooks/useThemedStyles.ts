import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { Theme } from '@/theme';

export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
   factory: (theme: Theme) => T
): T {
   const { theme } = useTheme();
   return useMemo(() => factory(theme), [theme, factory]);
}
