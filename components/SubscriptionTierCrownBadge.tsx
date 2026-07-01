import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { spacing } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';

interface SubscriptionTierCrownBadgeProps {
   style?: StyleProp<ViewStyle>;
}

export function hasPaidSubscriptionTier(
   minSubscriptionTier: number | null | undefined
): boolean {
   return minSubscriptionTier != null;
}

export const SubscriptionTierCrownBadge: React.FC<
   SubscriptionTierCrownBadgeProps
> = ({ style }) => {
   const { colors } = useTheme();

   return (
      <View style={[styles.badge, style]} pointerEvents="none">
         <MaterialCommunityIcons
            name="crown"
            size={16}
            color={colors.iconForegrounds.yellow}
         />
      </View>
   );
};

const styles = StyleSheet.create({
   badge: {
      position: 'absolute',
      top: spacing.xs,
      right: spacing.xs,
      zIndex: 2,
      alignItems: 'center',
      justifyContent: 'center',
   },
});
