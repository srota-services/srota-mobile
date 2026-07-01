import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { RootState } from '@/store';

interface HeaderProps {
   userName?: string;
   onDownloadPress?: () => void;
   onSearchPress?: () => void;
   onNotificationPress?: () => void;
}

/**
 * Header component with personalized greeting and action icons
 * Modern app header design
 * Uses same display name logic as My Audiobook screen (profile screen)
 */
const HeaderComponent: React.FC<HeaderProps> = ({
   userName: _userName,
   onDownloadPress,
   onSearchPress,
   onNotificationPress,
}) => {
   const { colors } = useTheme();
   const styles = useThemedStyles((t) =>
      StyleSheet.create({
         container: {
            backgroundColor: t.colors.background.dark,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            paddingBottom: spacing.md,
         },
         content: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
         },
         greeting: {
            fontSize: typography.fontSize.xl,
            fontWeight: '600',
            color: t.colors.text.dark,
            letterSpacing: -0.3,
            ...Platform.select({
               ios: {
                  fontFamily: 'System',
                  fontWeight: '600',
               },
               android: {
                  fontFamily: 'sans-serif-medium',
               },
            }),
         },
         iconsContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            marginRight: -spacing.xs,
         },
         iconButton: {
            padding: spacing.xs,
         },
      })
   );

   // Get user profile from Redux
   const userProfile = useSelector((state: RootState) => state.auth.userProfile);

   // Compute display name from user profile - use firstName only (not lastName)
   const displayName = useMemo(() => {
      if (userProfile) {
         if (userProfile.firstName) {
            return userProfile.firstName;
         }
         if (userProfile.username) {
            return userProfile.username;
         }
      }
      return ''; // Fallback if profile not loaded yet
   }, [userProfile]);
   return (
      <SafeAreaView edges={['top']} style={styles.container}>
         <View style={styles.content}>
            {/* Personalized greeting */}
            <Text style={styles.greeting}>For {displayName}</Text>

            {/* Action icons */}
            <View style={styles.iconsContainer}>
               <TouchableOpacity
                  onPress={onDownloadPress}
                  style={styles.iconButton}
                  activeOpacity={0.7}
               >
                  <Ionicons
                     name="download-outline"
                     size={24}
                     color={colors.text.dark}
                  />
               </TouchableOpacity>

               <TouchableOpacity
                  onPress={onSearchPress}
                  style={styles.iconButton}
                  activeOpacity={0.7}
               >
                  <Ionicons name="search-outline" size={24} color={colors.text.dark} />
               </TouchableOpacity>

               <TouchableOpacity
                  onPress={onNotificationPress}
                  style={styles.iconButton}
                  activeOpacity={0.7}
               >
                  <Ionicons
                     name="notifications-outline"
                     size={24}
                     color={colors.text.dark}
                  />
               </TouchableOpacity>
            </View>
         </View>
      </SafeAreaView>
   );
};

// Memoize component to prevent unnecessary re-renders when props haven't changed
export const Header = React.memo(HeaderComponent);
