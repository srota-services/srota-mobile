import React from 'react';
import {
   View,
   Text,
   StyleSheet,
   TouchableOpacity,
   Platform,
   Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Audiobook } from '@/services/audiobooks';
import { resolveAudiobookImageUrl } from '@/utils/imageAssets';
import { spacing, typography, borderRadius } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import {
   hasPaidSubscriptionTier,
   SubscriptionTierCrownBadge,
} from '@/components/SubscriptionTierCrownBadge';

export const GRID_PADDING = spacing.md;
export const GRID_GAP = spacing.sm;
export const NUM_COLUMNS = 2;

const screenWidth = Dimensions.get('window').width;
export const AUDIOBOOK_GRID_CARD_WIDTH =
   (screenWidth - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

export interface AudiobookGridCardProps {
   item: Audiobook;
   onPress: () => void;
   /** Shown in card footer instead of author when set */
   footerText?: string;
   onRemove?: () => void;
}

export const AudiobookGridCard: React.FC<AudiobookGridCardProps> = ({
   item,
   onPress,
   footerText,
   onRemove,
}) => {
   const { colors } = useTheme();
   const styles = useThemedStyles((t) =>
      StyleSheet.create({
         card: {
            position: 'relative',
            marginBottom: spacing.xs,
            borderRadius: borderRadius.md,
            overflow: 'hidden',
            backgroundColor: t.colors.background.card,
         },
         cardImageWrap: {
            position: 'relative',
            width: '100%',
         },
         cardImage: {
            width: '100%',
            aspectRatio: 0.7,
            backgroundColor: t.colors.background.highlight,
         },
         cardImagePlaceholder: {
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: t.colors.background.input,
         },
         cardImageLetter: {
            fontSize: typography.fontSize['2xl'],
            fontWeight: '700',
            color: t.colors.text.muted,
         },
         removeBadge: {
            position: 'absolute',
            top: spacing.xs,
            right: spacing.xs,
            zIndex: 2,
            backgroundColor: t.colors.background.screen,
            borderRadius: 11,
         },
         cardFooter: {
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.sm,
            backgroundColor: t.colors.background.card,
         },
         cardFooterText: {
            fontSize: typography.fontSize.sm,
            fontWeight: '600',
            color: t.colors.text.primary,
            textAlign: 'center',
            ...Platform.select({
               android: { fontFamily: 'sans-serif-medium' },
            }),
         },
      })
   );

   const coverUri = resolveAudiobookImageUrl(item, 'gridCard');
   const label = footerText ?? item.author;
   const showSubscriptionCrown = hasPaidSubscriptionTier(item.minSubscriptionTier);

   return (
      <View style={[styles.card, { width: AUDIOBOOK_GRID_CARD_WIDTH }]}>
         {onRemove && (
            <TouchableOpacity
               style={styles.removeBadge}
               onPress={onRemove}
               hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
               <Ionicons name="close-circle" size={22} color={colors.error} />
            </TouchableOpacity>
         )}
         <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
            <View style={styles.cardImageWrap}>
               {coverUri ? (
                  <Image source={{ uri: coverUri }} style={styles.cardImage} contentFit="cover" />
               ) : (
                  <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                     <Text style={styles.cardImageLetter}>
                        {(item.author || item.title).charAt(0)}
                     </Text>
                  </View>
               )}
               {showSubscriptionCrown ? (
                  <SubscriptionTierCrownBadge
                     style={onRemove ? { top: spacing.xs, left: spacing.xs, right: undefined } : undefined}
                  />
               ) : null}
            </View>
            <View style={styles.cardFooter}>
               <Text style={styles.cardFooterText} numberOfLines={2}>
                  {label}
               </Text>
            </View>
         </TouchableOpacity>
      </View>
   );
};
