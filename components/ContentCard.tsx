import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Image } from 'expo-image';
import { spacing, typography, borderRadius } from '@/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import {
   hasPaidSubscriptionTier,
   SubscriptionTierCrownBadge,
} from '@/components/SubscriptionTierCrownBadge';

interface ContentCardProps {
   title: string;
   imageUri?: string;
   badge?: string; // e.g., "TOP 10"
   minSubscriptionTier?: number | null;
   onPress?: () => void;
   cardWidth?: number;
}

/**
 * Content card component for horizontal scrollable rows
 * Displays content with image, title, and optional badge
 */
const ContentCardComponent: React.FC<ContentCardProps> = ({
   title,
   imageUri,
   badge,
   minSubscriptionTier,
   onPress,
   cardWidth = 140,
}) => {
   const styles = useThemedStyles((t) =>
      StyleSheet.create({
         container: {
            marginRight: spacing.sm,
         },
         imageContainer: {
            position: 'relative',
            width: '100%',
            aspectRatio: 0.7, // Portrait aspect ratio
            borderRadius: borderRadius.md,
            overflow: 'hidden',
            backgroundColor: t.colors.background.highlight,
         },
         image: {
            width: '100%',
            height: '100%',
            resizeMode: 'cover',
         },
         placeholder: {
            backgroundColor: t.colors.background.highlight,
            justifyContent: 'center',
            alignItems: 'center',
         },
         placeholderText: {
            fontSize: typography.fontSize['2xl'],
            color: t.colors.text.secondaryDark,
            fontWeight: '700',
         },
         badge: {
            position: 'absolute',
            top: spacing.xs,
            right: spacing.xs,
            backgroundColor: t.colors.accent.primary,
            paddingHorizontal: spacing.xs,
            paddingVertical: 2,
            borderRadius: borderRadius.sm,
         },
         badgeText: {
            color: '#FFFFFF',
            fontSize: typography.fontSize.xs,
            fontWeight: '700',
            ...Platform.select({
               ios: {
                  fontFamily: 'System',
                  fontWeight: '700',
               },
               android: {
                  fontFamily: 'sans-serif',
                  fontWeight: 'bold',
               },
            }),
         },
         title: {
            marginTop: spacing.xs,
            fontSize: typography.fontSize.sm,
            color: t.colors.text.primary,
            fontWeight: '500',
            ...Platform.select({
               ios: { fontFamily: 'System', fontWeight: '500' },
               android: { fontFamily: 'sans-serif' },
            }),
         },
      })
   );

   const showSubscriptionCrown = hasPaidSubscriptionTier(minSubscriptionTier);

   return (
      <TouchableOpacity
         onPress={onPress}
         style={[styles.container, { width: cardWidth }]}
         activeOpacity={0.8}
      >
         <View style={styles.imageContainer}>
            {imageUri ? (
               <Image
                  source={{ uri: imageUri }}
                  style={styles.image}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk" // Cache images for better performance
                  priority="normal" // Can be set to "high" for above-the-fold images
               />
            ) : (
               <View style={[styles.image, styles.placeholder]}>
                  <Text style={styles.placeholderText}>{title.charAt(0)}</Text>
               </View>
            )}

            {/* Badge overlay (e.g., TOP 10) */}
            {badge && (
               <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge}</Text>
               </View>
            )}
            {showSubscriptionCrown ? <SubscriptionTierCrownBadge /> : null}
         </View>

         {/* Title - optional, can be shown below or on overlay */}
         <Text style={styles.title} numberOfLines={2}>
            {title}
         </Text>
      </TouchableOpacity>
   );
};

// Memoize component to prevent unnecessary re-renders when props haven't changed
export const ContentCard = React.memo(ContentCardComponent);
