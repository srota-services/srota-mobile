import React, { useCallback, useMemo } from 'react';
import {
   View,
   Text,
   ScrollView,
   StyleSheet,
   TouchableOpacity,
   Platform,
} from 'react-native';
import { ContentCard } from './ContentCard';
import { spacing, typography } from '@/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

export interface ContentItem {
   id: string;
   title: string;
   imageUri?: string;
   badge?: string;
   minSubscriptionTier?: number | null;
}

interface ContentRowProps {
   title: string;
   items: ContentItem[];
   showMyListLink?: boolean;
   onItemPress?: (item: ContentItem) => void;
   onMyListPress?: () => void;
   cardWidth?: number;
   onEndReached?: () => void;
   onEndReachedThreshold?: number;
}

/**
 * Memoized item component to prevent re-renders when parent updates
 * This ensures each card only re-renders when its own props change
 */
const MemoizedContentCard = React.memo<{
   item: ContentItem;
   cardWidth: number;
   onPress: (item: ContentItem) => void;
}>(({ item, cardWidth, onPress }) => {
   const handlePress = useCallback(() => {
      onPress(item);
   }, [item, onPress]);

   return (
      <ContentCard
         title={item.title}
         imageUri={item.imageUri}
         badge={item.badge}
         minSubscriptionTier={item.minSubscriptionTier}
         onPress={handlePress}
         cardWidth={cardWidth}
      />
   );
}, (prevProps, nextProps) => {
   // Custom comparison function for better performance
   return (
      prevProps.item.id === nextProps.item.id &&
      prevProps.item.title === nextProps.item.title &&
      prevProps.item.imageUri === nextProps.item.imageUri &&
      prevProps.item.badge === nextProps.item.badge &&
      prevProps.item.minSubscriptionTier === nextProps.item.minSubscriptionTier &&
      prevProps.cardWidth === nextProps.cardWidth &&
      prevProps.onPress === nextProps.onPress
   );
});
MemoizedContentCard.displayName = 'MemoizedContentCard';

/**
 * Horizontal scrollable content row component
 * Displays a section title and scrollable cards
 */
const ContentRowComponent: React.FC<ContentRowProps> = ({
   title,
   items,
   showMyListLink = false,
   onItemPress,
   onMyListPress,
   cardWidth = 140,
   onEndReached,
   onEndReachedThreshold = 0.5,
}) => {
   const styles = useThemedStyles((t) =>
      StyleSheet.create({
         container: {
            marginBottom: spacing.lg,
            backgroundColor: t.colors.background.screen,
         },
         header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: spacing.md,
            marginBottom: spacing.sm,
         },
         title: {
            fontSize: typography.fontSize.lg,
            fontWeight: '600',
            color: t.colors.text.dark,
            letterSpacing: -0.2,
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
         myListLink: {
            fontSize: typography.fontSize.sm,
            color: t.colors.text.dark,
            fontWeight: '500',
            ...Platform.select({
               ios: {
                  fontFamily: 'System',
                  fontWeight: '500',
               },
               android: {
                  fontFamily: 'sans-serif',
               },
            }),
         },
         scrollContent: {
            paddingHorizontal: spacing.md,
         },
      })
   );

   // Memoize items to prevent recreation on every render
   const memoizedItems = useMemo(() => items, [items]);

   // Handle scroll to detect when user reaches end
   const handleScroll = useCallback(
      (event: { nativeEvent: { contentOffset: { x: number }; layoutMeasurement: { width: number }; contentSize: { width: number } } }) => {
         if (!onEndReached) return;

         const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
         const distanceFromEnd = contentSize.width - layoutMeasurement.width - contentOffset.x;
         const threshold = layoutMeasurement.width * onEndReachedThreshold;

         if (distanceFromEnd < threshold) {
            onEndReached();
         }
      },
      [onEndReached, onEndReachedThreshold]
   );

   return (
      <View style={styles.container}>
         {/* Section header */}
         <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            {showMyListLink && (
               <TouchableOpacity onPress={onMyListPress} activeOpacity={0.7}>
                  <Text style={styles.myListLink}>My List {'>'}</Text>
               </TouchableOpacity>
            )}
         </View>

         {/* Horizontal scrollable content */}
         <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            removeClippedSubviews={true} // Optimize scrolling performance
            onScroll={handleScroll}
            scrollEventThrottle={16} // Optimize scroll event handling
         >
            {memoizedItems.map((item) => (
               <MemoizedContentCard
                  key={item.id}
                  item={item}
                  cardWidth={cardWidth}
                  onPress={onItemPress || (() => { })}
               />
            ))}
         </ScrollView>
      </View>
   );
};

// Memoize component to prevent unnecessary re-renders when props haven't changed
export const ContentRow = React.memo(ContentRowComponent);
