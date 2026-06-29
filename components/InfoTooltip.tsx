import React, { useState } from 'react';
import {
   Modal,
   Pressable,
   StyleSheet,
   Text,
   TouchableOpacity,
   View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, spacing, typography } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';

interface InfoTooltipProps {
   message: string;
   accessibilityLabel?: string;
   iconSize?: number;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
   message,
   accessibilityLabel = 'More information',
   iconSize = 18,
}) => {
   const [visible, setVisible] = useState(false);
   const { colors } = useTheme();
   const styles = useThemedStyles((t) =>
      StyleSheet.create({
         trigger: {
            padding: spacing.xs,
         },
         backdrop: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            justifyContent: 'center',
            paddingHorizontal: spacing.lg,
         },
         bubble: {
            width: '100%',
            maxWidth: 320,
            alignSelf: 'center',
            backgroundColor: t.colors.background.screen,
            borderRadius: borderRadius.lg,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            borderWidth: 1,
            borderColor: t.colors.border.light,
         },
         contentRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            width: '100%',
         },
         iconCircle: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: t.colors.iconBackgrounds.yellow,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginRight: spacing.sm,
         },
         message: {
            flex: 1,
            flexShrink: 1,
            minWidth: 0,
            fontSize: typography.fontSize.sm,
            lineHeight: 20,
            color: t.colors.text.primary,
         },
      })
   );

   return (
      <>
         <TouchableOpacity
            style={styles.trigger}
            onPress={(event) => {
               event.stopPropagation?.();
               setVisible(true);
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
         >
            <Ionicons
               name="information-circle-outline"
               size={iconSize}
               color={colors.text.muted}
            />
         </TouchableOpacity>

         <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={() => setVisible(false)}
         >
            <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
               <Pressable style={styles.bubble} onPress={(event) => event.stopPropagation()}>
                  <View style={styles.contentRow}>
                     <View style={styles.iconCircle}>
                        <Ionicons
                           name="alert"
                           size={18}
                           color={colors.iconForegrounds.yellow}
                        />
                     </View>
                     <Text style={styles.message}>{message}</Text>
                  </View>
               </Pressable>
            </Pressable>
         </Modal>
      </>
   );
};
