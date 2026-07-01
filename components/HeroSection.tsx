import React, { useMemo, useState } from 'react';
import {
   View,
   Text,
   TouchableOpacity,
   StyleSheet,
   Dimensions,
   Platform,
} from 'react-native';
import Carousel, { ICarouselInstance } from 'react-native-reanimated-carousel';
import Animated, {
   interpolate,
   useSharedValue,
   useAnimatedStyle,
   withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { APP_BACK_ICON, APP_BACK_ICON_SIZE } from '@/constants/navigationIcons';
import { spacing, typography, borderRadius } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_WIDTH * 1.4; // Aspect ratio for hero section

interface HeroSectionProps {
   title?: string;
   author?: string;
   posterUri?: string;
   onPlayPress?: () => void;
   onMyListPress?: () => void;
   // Carousel props
   carouselItems?: { id: string; title: string; author: string; posterUri?: string }[];
   autoRotateInterval?: number; // milliseconds between rotations
   paused?: boolean; // Whether carousel should be paused (e.g., when screen is not focused)
   onIndexChange?: (index: number) => void; // Callback when carousel index changes
}

interface CarouselItem {
   id: string;
   title: string;
   author: string;
   posterUri?: string;
}

/**
 * Hero section component with large poster, title, and action buttons
 * Modern hero design with gradient overlay and Netflix-style carousel animations
 */
const HeroSectionComponent: React.FC<HeroSectionProps> = ({
   title,
   author,
   posterUri,
   onPlayPress,
   onMyListPress,
   carouselItems = [],
   autoRotateInterval = 5000, // Default 5 seconds
   paused = false, // Default to not paused
   onIndexChange,
}) => {
   const { colors } = useTheme();
   const styles = useThemedStyles((t) =>
      StyleSheet.create({
         container: {
            width: SCREEN_WIDTH,
            height: HERO_HEIGHT,
            position: 'relative',
            backgroundColor: t.colors.background.dark,
         },
         posterContainer: {
            width: '100%',
            height: '100%',
            position: 'relative',
            overflow: 'hidden', // Clip animated content
         },
         posterWrapper: {
            width: '100%',
            height: '100%',
         },
         poster: {
            width: '100%',
            height: '100%',
            resizeMode: 'cover',
         },
         posterPlaceholder: {
            backgroundColor: t.colors.background.darkGray,
            justifyContent: 'center',
            alignItems: 'center',
         },
         gradient: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '60%',
            zIndex: 1, // Ensure gradient is above carousel images
         },
         contentOverlay: {
            position: 'absolute',
            bottom: spacing.xl,
            left: spacing.md,
            right: spacing.md,
            zIndex: 2, // Ensure content is above gradient
         },
         textWrapper: {
            position: 'relative',
            marginBottom: 0, // No margin between text and buttons
            minHeight: 120, // Ensure minimum height for text area (2 lines title + 1 line author)
         },
         textPlaceholder: {
            opacity: 0, // Invisible but maintains layout space
            flexShrink: 0, // Prevent shrinking
         },
         textContainer: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            flexShrink: 0, // Prevent container from shrinking
         },
         title: {
            fontSize: typography.fontSize['4xl'],
            fontWeight: '700',
            color: t.colors.text.dark,
            marginBottom: spacing.sm,
            letterSpacing: -0.5,
            flexShrink: 0, // Prevent text from shrinking
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
         author: {
            fontSize: typography.fontSize.sm,
            color: t.colors.text.dark,
            marginBottom: 0, // Remove bottom margin - spacing handled by textWrapper
            opacity: 0.9,
            flexShrink: 0, // Prevent text from shrinking
         },
         actionsContainer: {
            flexDirection: 'row',
            gap: spacing.md, // Gap between buttons only, not between text and buttons
            marginTop: 0, // No margin - buttons should be directly below text
         },
         playButton: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: t.colors.text.dark,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.md,
            gap: spacing.xs,
         },
         playButtonText: {
            color: t.colors.background.dark,
            fontSize: typography.fontSize.base,
            fontWeight: '600',
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
         myListButton: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: t.colors.background.darkGray,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.md,
            gap: spacing.xs,
         },
         myListButtonText: {
            color: t.colors.text.dark,
            fontSize: typography.fontSize.base,
            fontWeight: '600',
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
         // Navigation arrow styles
         leftArrow: {
            position: 'absolute',
            left: spacing.md,
            top: '50%',
            transform: [{ translateY: -20 }], // Center vertically
            zIndex: 3, // Above carousel but below content overlay
         },
         rightArrow: {
            position: 'absolute',
            right: spacing.md,
            top: '50%',
            transform: [{ translateY: -20 }], // Center vertically
            zIndex: 3, // Above carousel but below content overlay
         },
         arrowButton: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
         },
         // Pagination dots styles
         paginationContainer: {
            position: 'absolute',
            bottom: spacing.xl + 100, // Position above content overlay (text + buttons area)
            left: 0,
            right: 0,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 3, // Above gradient but below content overlay
            gap: spacing.xs,
            paddingHorizontal: spacing.md,
         },
         paginationDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: 'rgba(255, 255, 255, 0.4)',
         },
         paginationDotActive: {
            width: 24,
            height: 8,
            borderRadius: 4,
            backgroundColor: t.colors.text.dark,
         },
      })
   );

   const carouselRef = React.useRef<ICarouselInstance>(null);
   const [currentIndex, setCurrentIndex] = useState(0);
   // Shared value for text fade animation
   const textOpacity = useSharedValue(1);

   // Prepare data for carousel - use carouselItems if available, otherwise use single item
   const carouselData: CarouselItem[] = useMemo(() => {
      if (carouselItems.length > 0) {
         return carouselItems;
      }
      // Single item fallback (id is optional for single item mode)
      return [{ id: '', title: title || 'BARAMULLA', author: author || '', posterUri }];
   }, [carouselItems, title, author, posterUri]);

   // Reset carousel when data changes
   React.useEffect(() => {
      if (carouselRef.current && carouselData.length > 1) {
         // Reset to first item when data changes
         carouselRef.current.scrollTo({ index: 0, animated: false });
         setCurrentIndex(0);
         textOpacity.value = 1;
      }
   }, [carouselData.length, textOpacity]);

   // Get current item based on carousel index
   const currentItem = useMemo(() => {
      return carouselData[currentIndex] || carouselData[0];
   }, [carouselData, currentIndex]);

   // Handle carousel index change with fade animation
   const handleIndexChange = (index: number) => {
      // Update index immediately (this runs on JS thread, so it's safe)
      setCurrentIndex(index);
      // Notify parent component of index change
      if (onIndexChange) {
         onIndexChange(index);
      }
      // Fade out current text quickly, then fade in new text
      textOpacity.value = withTiming(0, { duration: 200 }, () => {
         // Fade in new text slowly (600ms for smooth, visible transition)
         // This callback runs on UI thread, but we're only updating shared values, which is safe
         textOpacity.value = withTiming(1, { duration: 600 });
      });
   };

   // Navigation handlers for arrow buttons
   const handleNext = () => {
      if (carouselData.length > 1 && carouselRef.current) {
         carouselRef.current.next();
      }
   };

   const handlePrev = () => {
      if (carouselData.length > 1 && carouselRef.current) {
         carouselRef.current.prev();
      }
   };

   // Custom fade-in/fade-out animation for Netflix-style effect
   // Value represents the position: -1 (left/out), 0 (center/active), 1 (right/out)
   const fadeAnimation = (value: number) => {
      'worklet';
      // Fade in/out: opacity goes from 0 (off-screen) to 1 (center) and back to 0
      const opacity = interpolate(value, [-1, 0, 1], [0, 1, 0]);
      // Subtle scale effect: slightly smaller when off-screen, full size when active
      const scale = interpolate(value, [-1, 0, 1], [0.95, 1, 0.95]);

      return {
         opacity,
         transform: [{ scale }],
      };
   };

   // Animated style for text overlay - fades with carousel
   const textAnimatedStyle = useAnimatedStyle(() => {
      return {
         opacity: textOpacity.value,
      };
   });

   // Render individual carousel item (poster image)
   // Memoize to prevent unnecessary re-renders and image reloads
   const renderCarouselItem = React.useCallback(
      ({ item }: { item: CarouselItem }) => {
         return (
            <View style={styles.posterWrapper}>
               {item.posterUri ? (
                  <Image
                     source={{ uri: item.posterUri }}
                     style={styles.poster}
                     contentFit="cover"
                     transition={0} // Disable expo-image transition, use carousel animation instead
                     cachePolicy="memory-disk" // Cache hero images for better performance
                     priority="high" // High priority for hero section (above-the-fold)
                     // Stable key ensures proper caching and prevents reloads
                     key={item.id || item.posterUri}
                  />
               ) : (
                  <View style={[styles.poster, styles.posterPlaceholder]}>
                     <Ionicons name="film-outline" size={64} color={colors.neutral[600]} />
                  </View>
               )}
            </View>
         );
      },
      [styles, colors.neutral]
   );

   return (
      <View style={styles.container}>
         {/* Carousel for poster images */}
         <View style={styles.posterContainer}>
            <Carousel
               ref={carouselRef}
               width={SCREEN_WIDTH}
               height={HERO_HEIGHT}
               data={carouselData}
               renderItem={renderCarouselItem}
               loop={carouselData.length > 1}
               autoPlay={carouselData.length > 1 && !paused}
               autoPlayInterval={autoRotateInterval}
               onSnapToItem={handleIndexChange}
               // Netflix-style fade-in/fade-out animation
               customAnimation={fadeAnimation}
               // Smooth animation duration
               scrollAnimationDuration={800}
               // Enable pan gesture for manual swiping
               enabled={carouselData.length > 1}
               // Optimize performance - increase window size to keep more items cached
               // This prevents images from being unloaded and reloaded as carousel rotates
               windowSize={5}
            />

            {/* Navigation arrows - only show when multiple items */}
            {carouselData.length > 1 && (
               <>
                  {/* Left arrow */}
                  <TouchableOpacity
                     style={styles.leftArrow}
                     onPress={handlePrev}
                     activeOpacity={0.7}
                  >
                     <View style={styles.arrowButton}>
                        <Ionicons
                           name={APP_BACK_ICON}
                           size={APP_BACK_ICON_SIZE}
                           color={colors.text.dark}
                        />
                     </View>
                  </TouchableOpacity>

                  {/* Right arrow */}
                  <TouchableOpacity
                     style={styles.rightArrow}
                     onPress={handleNext}
                     activeOpacity={0.7}
                  >
                     <View style={styles.arrowButton}>
                        <Ionicons name="chevron-forward" size={24} color={colors.text.dark} />
                     </View>
                  </TouchableOpacity>
               </>
            )}

            {/* Pagination dots - only show when multiple items */}
            {carouselData.length > 1 && (
               <View style={styles.paginationContainer}>
                  {carouselData.map((_, index) => (
                     <View
                        key={index}
                        style={[
                           styles.paginationDot,
                           index === currentIndex && styles.paginationDotActive,
                        ]}
                     />
                  ))}
               </View>
            )}

            {/* Gradient overlay for better text readability */}
            <LinearGradient
               colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
               locations={[0, 0.5, 1]}
               style={styles.gradient}
            />
         </View>

         {/* Content overlay with text and action buttons */}
         <View style={styles.contentOverlay}>
            {/* Text container */}
            <View style={styles.textWrapper}>
               <View style={styles.textPlaceholder} pointerEvents="none">
                  <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
                     {currentItem.title}
                  </Text>
                  {currentItem.author && (
                     <Text style={styles.author} numberOfLines={1} ellipsizeMode="tail">
                        {currentItem.author}
                     </Text>
                  )}
               </View>

               {/* Actual text content with fade animation */}
               {/* Use key to force re-render when item changes for proper text sync */}
               <Animated.View
                  key={`text-${currentIndex}`}
                  style={[styles.textContainer, textAnimatedStyle]}
               >
                  <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
                     {currentItem.title}
                  </Text>
                  {currentItem.author && (
                     <Text style={styles.author} numberOfLines={1} ellipsizeMode="tail">
                        {currentItem.author}
                     </Text>
                  )}
               </Animated.View>
            </View>

            {/* Action buttons */}
            <View style={styles.actionsContainer}>
               <TouchableOpacity
                  onPress={onPlayPress}
                  style={styles.playButton}
                  activeOpacity={0.8}
               >
                  <Ionicons name="play" size={20} color={colors.background.dark} />
                  <Text style={styles.playButtonText}>Play</Text>
               </TouchableOpacity>

               <TouchableOpacity
                  onPress={onMyListPress}
                  style={styles.myListButton}
                  activeOpacity={0.8}
               >
                  <Ionicons name="add" size={20} color={colors.text.dark} />
                  <Text style={styles.myListButtonText}>My List</Text>
               </TouchableOpacity>
            </View>
         </View>
      </View>
   );
};

// Memoize component to prevent unnecessary re-renders when props haven't changed
export const HeroSection = React.memo(HeroSectionComponent);
