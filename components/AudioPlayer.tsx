/**
 * Audio Player Component
 * Displays audio player UI with playback controls and progress
 */

import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import {
   View,
   Text,
   StyleSheet,
   TouchableOpacity,
   Platform,
   ActivityIndicator,
   Dimensions,
   PanResponder,
   ScrollView,
} from 'react-native';
import Animated, {
   useAnimatedStyle,
   useSharedValue,
   withTiming,
   withSpring,
   cancelAnimation,
   Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useSegments } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store';
import { setMinimized, setUiSuppressed, releasePlayback } from '@/store/player';
import { useAudioPlayerControls } from '@/contexts/AudioPlaybackContext';
import { PlaybackSpeedSheet } from '@/components/PlaybackSpeedSheet';
import { SleepTimerSheet } from '@/components/SleepTimerSheet';
import { AudioPlayerSeekBar } from '@/components/AudioPlayerSeekBar';
import {
   formatPlaybackSpeedLabel,
   type PlaybackSpeed,
} from '@/constants/playbackSpeed';
import {
   formatSleepTimerLabel,
   formatSleepTimerRemaining,
   type SleepTimerOption,
} from '@/constants/sleepTimer';
import { startSleepTimer, clearSleepTimer } from '@/store/settings';
import { isSleepTimerActive } from '@/utils/sleepTimer';
import { usePlaybackSync } from '@/hooks/usePlaybackSync';
import { useBookmark, useBookmarkMutations } from '@/hooks/useBookmark';
import { syncPlayback, initializePlaybackSession } from '@/services/audiobooks';
import { saveChapterPlaybackProgress } from '@/utils/markChapterCompletedAtEnd';
import { spacing, typography, borderRadius, shadows } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import {
   getTabBarHeight,
   getTabBarFloatHorizontal,
   getMinimizedPlayerBottom,
   MINIMIZED_PLAYER_BAR_HEIGHT,
} from '@/theme/tabLayout';
import { formatDuration } from '@/utils/duration';
import { toDisplayImageUri } from '@/utils/imageAssets';
import { PLAYER_BOTTOM_SPRING } from '@/theme/tabAnimation';

/**
 * Audio Player component
 * Shows player UI when a chapter is being played
 */
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Proportional sizing for full player internals (~1.25× compact layout) */
const FP = {
   paddingHorizontal: spacing.lg,
   paddingTop: spacing.md,
   paddingBottom: spacing.lg,
   coverSize: 240,
   headerChevronSize: 34,
   headerMenuIconSize: 28,
   chapterLabelSize: typography.fontSize.base,
   chapterTitleSize: typography.fontSize['2xl'],
   playButtonSize: 72,
   playIconSize: 40,
   chapterSkipIconSize: 34,
   seekIconSize: 30,
   bottomActionIconSize: 28,
   dragHandlerWidth: 48,
   dragHandlerHeight: 5,
   dragHandlerMinHeight: 36,
   headerMarginBottom: spacing.md,
   coverMarginBottom: spacing.md,
   controlsMarginBottom: spacing.sm,
   bottomActionsPaddingTop: spacing.md,
   bottomActionTextSize: typography.fontSize.sm,
   seekButtonTextSize: typography.fontSize.sm,
} as const;

/** Minimized bar — horizontal layout above tab bar or screen bottom */
const MINIMIZED_BAR = {
   height: MINIMIZED_PLAYER_BAR_HEIGHT,
   coverSize: 56,
   playIconSize: 28,
} as const;

export const AudioPlayer: React.FC = React.memo(() => {
   const { colors } = useTheme();
   const styles = useThemedStyles((t) =>
      StyleSheet.create({
         container: {
            position: 'absolute',
            backgroundColor: 'transparent',
            overflow: 'visible',
         },
         playerSheet: {
            alignSelf: 'stretch',
         },
         hiddenVideo: {
            width: 0,
            height: 0,
            position: 'absolute',
         },
         playerContainer: {
            paddingHorizontal: FP.paddingHorizontal,
            paddingTop: FP.paddingTop,
            paddingBottom: FP.paddingBottom,
            backgroundColor: t.colors.background.player,
            borderRadius: borderRadius.xl,
            overflow: 'hidden',
            ...shadows.lg,
            ...Platform.select({
               android: { elevation: 12 },
            }),
         },
         playerScrollContent: {
            flexGrow: 0,
            flexShrink: 1,
            minHeight: 0,
         },
         playerScrollContentContainer: {
            flexGrow: 1,
         },
         dragMinimizeZone: {
            flexShrink: 0,
         },
         playerFixedFooter: {
            flexShrink: 0,
         },
         header: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            alignItems: 'center',
            marginBottom: FP.headerMarginBottom,
         },
         chapterLabel: {
            fontSize: FP.chapterLabelSize,
            color: t.colors.text.secondary,
            textAlign: 'center',
            marginBottom: spacing.xs,
         },
         chapterTitle: {
            fontSize: FP.chapterTitleSize,
            fontWeight: '700',
            color: t.colors.accent.primaryDark,
            textAlign: 'center',
            marginBottom: spacing.sm,
            paddingHorizontal: spacing.md,
         },
         bottomActionsDivider: {
            height: 1,
            backgroundColor: t.colors.background.highlight,
            marginBottom: FP.bottomActionsPaddingTop,
         },
         bottomActions: {
            flexDirection: 'row',
            justifyContent: 'space-around',
         },
         bottomAction: {
            alignItems: 'center',
            padding: spacing.sm,
         },
         bottomActionText: {
            fontSize: FP.bottomActionTextSize,
            color: t.colors.text.secondary,
            marginTop: spacing.xs,
         },
         title: {
            fontSize: typography.fontSize.lg,
            fontWeight: '600',
            color: t.colors.text.dark,
            flex: 1,
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
         headerButtons: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
         },
         dragHandlerContainer: {
            alignItems: 'center',
            paddingTop: spacing.sm,
            paddingBottom: spacing.sm,
            minHeight: FP.dragHandlerMinHeight,
            justifyContent: 'center',
         },
         dragHandler: {
            width: FP.dragHandlerWidth,
            height: FP.dragHandlerHeight,
            backgroundColor: t.colors.text.secondaryDark,
            borderRadius: FP.dragHandlerHeight / 2,
            opacity: 0.5,
         },
         closeButton: {
            padding: spacing.xs,
         },
         coverContainer: {
            alignSelf: 'center',
            marginBottom: FP.coverMarginBottom,
            borderRadius: borderRadius.xl,
            overflow: 'hidden',
         },
         coverImage: {
            width: '100%',
            height: '100%',
         },
         controlsContainer: {
            alignSelf: 'stretch',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: FP.controlsMarginBottom,
         },
         controlsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            alignSelf: 'stretch',
            width: '100%',
         },
         playButton: {
            width: FP.playButtonSize,
            height: FP.playButtonSize,
            borderRadius: FP.playButtonSize / 2,
            backgroundColor: t.colors.accent.primary,
            justifyContent: 'center',
            alignItems: 'center',
         },
         chapterButton: {
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            paddingVertical: spacing.xs,
         },
         seekButton: {
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 44,
            paddingHorizontal: spacing.xs,
            paddingVertical: spacing.xs,
         },
         seekButtonText: {
            fontSize: FP.seekButtonTextSize,
            color: t.colors.text.secondaryDark,
            marginTop: spacing.xs,
            ...Platform.select({
               ios: {
                  fontFamily: 'System',
                  fontWeight: '400',
               },
               android: {
                  fontFamily: 'sans-serif',
               },
            }),
         },
         errorContainer: {
            alignItems: 'center',
         },
         errorText: {
            fontSize: typography.fontSize.sm,
            color: t.colors.app.red,
            marginBottom: spacing.md,
            textAlign: 'center',
            ...Platform.select({
               ios: {
                  fontFamily: 'System',
                  fontWeight: '400',
               },
               android: {
                  fontFamily: 'sans-serif',
               },
            }),
         },
         retryButton: {
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            backgroundColor: t.colors.app.red,
            borderRadius: borderRadius.md,
         },
         retryButtonText: {
            fontSize: typography.fontSize.base,
            color: t.colors.text.light,
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
         iconWrapper: {
            justifyContent: 'center',
            alignItems: 'center',
         },
         playIconOffset: {
            marginLeft: 1,
         },
         minimizedBarOuter: {
            borderRadius: borderRadius.xl,
            overflow: 'hidden',
            ...shadows.lg,
            ...Platform.select({
               android: { elevation: 12 },
            }),
         },
         minimizedBar: {
            flexDirection: 'row',
            alignItems: 'center',
            height: MINIMIZED_BAR.height,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.sm,
            backgroundColor: t.colors.background.player,
            borderRadius: borderRadius.xl,
            gap: spacing.sm,
            ...shadows.lg,
            ...Platform.select({
               android: { elevation: 8 },
            }),
         },
         minimizedCoverWrap: {
            width: MINIMIZED_BAR.coverSize,
            height: MINIMIZED_BAR.coverSize,
            borderRadius: borderRadius.md,
            overflow: 'hidden',
            flexShrink: 0,
         },
         minimizedCoverImage: {
            width: '100%',
            height: '100%',
            backgroundColor: t.colors.background.highlight,
         },
         minimizedCoverPlaceholder: {
            justifyContent: 'center',
            alignItems: 'center',
         },
         minimizedInfo: {
            flex: 1,
            minWidth: 0,
            justifyContent: 'center',
            gap: 2,
         },
         minimizedTitle: {
            fontSize: typography.fontSize.base,
            fontWeight: '700',
            color: t.colors.accent.primaryDark,
         },
         minimizedChapterMeta: {
            fontSize: typography.fontSize.sm,
            color: t.colors.text.secondary,
         },
         minimizedTimeText: {
            fontSize: typography.fontSize.sm,
            color: t.colors.text.secondary,
            marginBottom: spacing.xs / 2,
         },
         minimizedProgressTrack: {
            height: 4,
            borderRadius: borderRadius.sm,
            backgroundColor: t.colors.border.light,
            overflow: 'hidden',
         },
         minimizedProgressFill: {
            height: '100%',
            backgroundColor: t.colors.accent.primary,
            borderRadius: borderRadius.sm,
         },
         minimizedPlayControl: {
            width: 40,
            height: 40,
            justifyContent: 'center',
            alignItems: 'center',
         },
         minimizedTrailingControls: {
            flexDirection: 'row',
            alignItems: 'center',
            flexShrink: 0,
            gap: spacing.xs,
         },
         minimizedCloseControl: {
            width: 36,
            height: 36,
            justifyContent: 'center',
            alignItems: 'center',
         },
      })
   );

   const dispatch = useDispatch();
   const insets = useSafeAreaInsets();
   const segments = useSegments();
   const hasBottomTabBar = segments[0] === '(tabs)';
   const {
      isPlaying,
      currentChapterId,
      playbackPosition,
      totalDuration,
      chapterEndPosition,
      isLoading,
      error,
      isVisible,
      isMinimized,
      isUiSuppressed,
      chapterMetadata,
      audiobookId,
   } = useSelector((state: RootState) => state.player);

   const skipDurationSeconds = useSelector(
      (state: RootState) => state.settings.skipDurationSeconds
   );
   const playbackSpeed = useSelector((state: RootState) => state.settings.playbackSpeed);
   const sleepTimerOption = useSelector(
      (state: RootState) => state.settings.sleepTimerOption
   );
   const sleepTimerEndsAt = useSelector(
      (state: RootState) => state.settings.sleepTimerEndsAt
   );
   const settings = useSelector((state: RootState) => state.settings);
   const [speedSheetVisible, setSpeedSheetVisible] = useState(false);
   const [sleepTimerSheetVisible, setSleepTimerSheetVisible] = useState(false);
   const [, setSleepTimerTick] = useState(0);

   // Get user from Redux for session initialization
   const user = useSelector((state: RootState) => state.auth.user);

   // Animation shared values
   const translateY = useSharedValue(SCREEN_HEIGHT);
   const opacity = useSharedValue(0);
   const fullPlayerOpacity = useSharedValue(0);
   const minimizedOpacity = useSharedValue(0);
   const containerBottom = useSharedValue(0);
   const isMountedRef = useRef(false);
   const hasInitializedBottomRef = useRef(false);
   const previousVisibleRef = useRef(false);
   const previousMinimizedRef = useRef(false);

   // Drag-to-minimize shared values and refs
   const dragY = useSharedValue(0);
   const isDraggingDown = useRef(false);
   const dragStartY = useRef(0);
   const isMinimizedRef = useRef(isMinimized);

   // Use audio player hook
   const {
      handleSeek,
      seekToTime,
      playPlayback,
      pausePlayback,
      skipToNextChapter,
      skipToPreviousChapter,
      setDragging,
      resetPlayer,
      setPlaybackRate,
   } = useAudioPlayerControls();

   const handleSpeedSelect = useCallback(
      (speed: PlaybackSpeed) => {
         setPlaybackRate(speed);
         setSpeedSheetVisible(false);
      },
      [setPlaybackRate]
   );

   const sleepTimerActive = isSleepTimerActive(settings);

   const sleepTimerLabel =
      !sleepTimerActive
         ? 'Off'
         : sleepTimerOption === 'endOfChapter'
           ? 'End ch.'
           : sleepTimerEndsAt
             ? formatSleepTimerRemaining(sleepTimerEndsAt)
             : formatSleepTimerLabel(sleepTimerOption);

   useEffect(() => {
      if (!sleepTimerActive || sleepTimerOption === 'endOfChapter' || !sleepTimerEndsAt) {
         return;
      }
      const id = setInterval(() => setSleepTimerTick((t) => t + 1), 1000);
      return () => clearInterval(id);
   }, [sleepTimerActive, sleepTimerOption, sleepTimerEndsAt]);

   const handleSleepTimerSelect = useCallback(
      (option: SleepTimerOption) => {
         if (option === 'off') {
            dispatch(clearSleepTimer());
         } else {
            dispatch(startSleepTimer(option));
         }
         setSleepTimerSheetVisible(false);
      },
      [dispatch]
   );

   const { data: bookmark } = useBookmark(currentChapterId);
   const { add: addBookmark, remove: removeBookmark } =
      useBookmarkMutations(currentChapterId);

   const handleBookmarkPress = useCallback(() => {
      if (!currentChapterId || addBookmark.isPending || removeBookmark.isPending) {
         return;
      }
      if (bookmark) {
         removeBookmark.mutate(bookmark.id);
      } else {
         addBookmark.mutate();
      }
   }, [
      currentChapterId,
      bookmark,
      addBookmark,
      removeBookmark,
   ]);

   // Use playback sync hook to automatically sync every 5 seconds during playback
   // Only sync when player is visible (active)
   usePlaybackSync({
      audiobookId,
      chapterId: currentChapterId,
      playbackPosition,
      totalDuration,
      isPlaying,
      isActive: isVisible, // Only sync when player is visible/active
   });

   const handleSeekStart = useCallback(() => {
      setDragging(true);
   }, [setDragging]);

   const handleSeekEnd = useCallback(() => {
      setDragging(false);
   }, [setDragging]);

   const handleSeekComplete = useCallback(
      (seconds: number) => seekToTime(seconds),
      [seekToTime]
   );

   // Get chapter cover image URI based on minimized state
   const chapterCoverUri = useMemo(() => {
      if (!chapterMetadata) return undefined;

      // Use minimizedChapterCoverImage when minimized, maximizedChapterCoverImage when maximized
      const imagePath = isMinimized
         ? chapterMetadata.minimizedChapterCoverImage
         : chapterMetadata.maximizedChapterCoverImage;

      // Fallback to coverImage if specific image is not available
      const finalImagePath = imagePath || chapterMetadata.coverImage;

      if (!finalImagePath) return undefined;
      return toDisplayImageUri(finalImagePath);
   }, [chapterMetadata, isMinimized]);

   // Handle play/pause toggle
   const handlePlayPause = useCallback(() => {
      if (isPlaying) {
         void pausePlayback();
         if (isVisible && audiobookId && currentChapterId) {
            const durationHint = totalDuration > 0 ? totalDuration : playbackPosition;
            if (durationHint > 0 || playbackPosition > 0) {
               void saveChapterPlaybackProgress(
                  audiobookId,
                  currentChapterId,
                  playbackPosition,
                  durationHint,
                  { completed: false }
               ).catch((error: unknown) => {
                  console.error('[Audio Player] Failed to save progress on pause:', error);
               });
            }
         }
      } else {
         void playPlayback();
         // Sync playback state immediately when user clicks play (only if player is active)
         // The usePlaybackSync hook will also call play action after 1 second, but we call it immediately here
         // to ensure the API is called as soon as the user clicks play
         if (isVisible && audiobookId && currentChapterId) {
            syncPlayback({
               audiobookId,
               chapterId: currentChapterId,
               action: 'play',
               position: playbackPosition,
               durationSeconds: totalDuration > 0 ? totalDuration : undefined,
            }).catch((error: unknown) => {
               console.error('[Audio Player] Failed to sync playback on play:', error);
            });
         }
      }
   }, [
      isPlaying,
      isVisible,
      audiobookId,
      currentChapterId,
      playbackPosition,
      totalDuration,
      playPlayback,
      pausePlayback,
   ]);

   // Handle expand (when clicking on minimized player)
   const handleExpand = () => {
      dispatch(setMinimized(false));
   };

   const handleClose = useCallback(() => {
      void (async () => {
         if (audiobookId && currentChapterId) {
            const durationHint = totalDuration > 0 ? totalDuration : playbackPosition;
            if (durationHint > 0 || playbackPosition > 0) {
               await saveChapterPlaybackProgress(
                  audiobookId,
                  currentChapterId,
                  playbackPosition,
                  durationHint,
                  { completed: false }
               ).catch((error: unknown) => {
                  console.error('[Audio Player] Failed to save progress on close:', error);
               });
            }
         }
         if (isPlaying) {
            await pausePlayback();
         }
         await resetPlayer();
         dispatch(releasePlayback());
      })();
   }, [
      isPlaying,
      audiobookId,
      currentChapterId,
      playbackPosition,
      totalDuration,
      pausePlayback,
      resetPlayer,
      dispatch,
   ]);

   useEffect(() => {
      isMinimizedRef.current = isMinimized;
   }, [isMinimized]);

   const handleDiscussPress = useCallback(() => {
      if (!audiobookId || !currentChapterId) return;
      dispatch(setUiSuppressed(true));
      dispatch(setMinimized(true));
      router.push({
         pathname: '/chapter-comments',
         params: {
            audiobookId,
            chapterId: currentChapterId,
            chapterTitle: chapterMetadata?.title ?? 'Chapter',
            ...(chapterMetadata?.chapterNumber != null
               ? { chapterNumber: String(chapterMetadata.chapterNumber) }
               : {}),
         },
      } as never);
   }, [audiobookId, currentChapterId, chapterMetadata?.title, chapterMetadata?.chapterNumber, dispatch]);

   // Pan responder for drag-to-minimize on the top handle / header zone
   const panResponder = useRef(
      PanResponder.create({
         onStartShouldSetPanResponder: () => false,
         onStartShouldSetPanResponderCapture: () => false,
         onMoveShouldSetPanResponder: (_evt, gestureState) => {
            if (isMinimizedRef.current) return false;
            return (
               gestureState.dy > 6 &&
               gestureState.dy > Math.abs(gestureState.dx)
            );
         },
         onMoveShouldSetPanResponderCapture: (_evt, gestureState) => {
            if (isMinimizedRef.current) return false;
            return (
               gestureState.dy > 6 &&
               gestureState.dy > Math.abs(gestureState.dx)
            );
         },
         onPanResponderGrant: (evt) => {
            isDraggingDown.current = true;
            dragStartY.current = evt.nativeEvent.pageY;
            dragY.value = 0;
         },
         onPanResponderMove: (_evt, gestureState) => {
            if (isDraggingDown.current && gestureState.dy > 0) {
               dragY.value = Math.max(0, gestureState.dy);
            }
         },
         onPanResponderRelease: (_evt, gestureState) => {
            isDraggingDown.current = false;
            if (gestureState.dy > 80) {
               dispatch(setMinimized(true));
               dragY.value = withSpring(0, {
                  damping: 20,
                  stiffness: 200,
               });
            } else {
               dragY.value = withSpring(0, {
                  damping: 15,
                  stiffness: 150,
               });
            }
         },
         onPanResponderTerminate: () => {
            isDraggingDown.current = false;
            dragY.value = withSpring(0, {
               damping: 15,
               stiffness: 150,
            });
         },
      })
   ).current;

   // Animated style for drag-to-minimize
   const dragAnimatedStyle = useAnimatedStyle(() => {
      return {
         transform: [{ translateY: dragY.value }],
      };
   });

   const handleBackward = () => {
      handleSeek(-skipDurationSeconds);
   };

   const handleForward = () => {
      handleSeek(skipDurationSeconds);
   };

   // Calculate elapsed time for minimized display
   const totalTime = useMemo(() => {
      return Math.floor(totalDuration);
   }, [totalDuration]);

   const minimizedProgress = useMemo(() => {
      if (totalDuration <= 0) return 0;
      return Math.min(1, Math.max(0, playbackPosition / totalDuration));
   }, [playbackPosition, totalDuration]);

   const minimizedChapterLabel = useMemo(() => {
      if (!chapterMetadata?.chapterNumber) {
         return 'Chapter';
      }
      if (chapterMetadata.totalChapters) {
         return `Chapter ${chapterMetadata.chapterNumber} of ${chapterMetadata.totalChapters}`;
      }
      return `Chapter ${chapterMetadata.chapterNumber}`;
   }, [chapterMetadata]);

   const minimizedElapsed = useMemo(() => Math.floor(playbackPosition), [playbackPosition]);

   // Calculate dynamic tab bar height with safe area insets (needed for animations)
   const tabBarHeight = getTabBarHeight(insets.bottom);
   const playerFloatHorizontal = getTabBarFloatHorizontal();
   /** Full player sits near the screen bottom with a small margin above the safe area */
   const maximizedBottomPosition = insets.bottom + spacing.sm;

   /** Keep the card within the safe area (top inset + bottom anchor) */
   const fullPlayerLayout = useMemo(() => {
      const topMargin = spacing.sm;
      const maxHeight = SCREEN_HEIGHT - maximizedBottomPosition - insets.top - topMargin;
      const coverSize = Math.min(FP.coverSize, Math.max(152, Math.round(maxHeight * 0.24)));
      return {
         maxHeight: Math.max(300, maxHeight),
         coverSize,
      };
   }, [maximizedBottomPosition, insets.top]);

   // Minimized bar: above tab bar on tab screens, near bottom on stack screens (e.g. details)
   const minimizedBottomPosition = useMemo(
      () => getMinimizedPlayerBottom(hasBottomTabBar, insets.bottom),
      [hasBottomTabBar, insets.bottom]
   );

   const targetContainerBottom = isMinimized
      ? minimizedBottomPosition
      : maximizedBottomPosition;

   // Smooth spring when bottom offset changes (route change or minimize/maximize)
   useEffect(() => {
      cancelAnimation(containerBottom);
      if (!hasInitializedBottomRef.current) {
         containerBottom.value = targetContainerBottom;
         hasInitializedBottomRef.current = true;
         return;
      }
      containerBottom.value = withSpring(targetContainerBottom, PLAYER_BOTTOM_SPRING);
   }, [targetContainerBottom, containerBottom]);


   // Handle open/close animations
   useEffect(() => {
      if (!isMountedRef.current) {
         // Initial mount - set initial values based on visibility
         if (isVisible) {
            // Always set translateY to 0 when visible (both minimized and maximized)
            translateY.value = 0;
            opacity.value = 1;
            // Set opacity immediately and synchronously - no animation on initial mount
            if (isMinimized) {
               minimizedOpacity.value = 1;
               fullPlayerOpacity.value = 0;
            } else {
               fullPlayerOpacity.value = 1;
               minimizedOpacity.value = 0;
            }
         } else {
            const bottomOffset = isMinimized ? minimizedBottomPosition : maximizedBottomPosition;
            const containerHeight = SCREEN_HEIGHT - bottomOffset;
            translateY.value = containerHeight;
            opacity.value = 0;
         }
         isMountedRef.current = true;
         previousVisibleRef.current = isVisible;
         previousMinimizedRef.current = isMinimized;
         return;
      }

      // Handle visibility changes (open/close)
      if (isVisible !== previousVisibleRef.current) {
         if (isVisible) {
            // Player is opening - initialize playback session every time the player opens
            // This ensures the session API is called when the player is opened, even if it's the same chapter
            // We check if this is a new "open" event (was not visible before) to avoid duplicate calls
            if (
               currentChapterId &&
               audiobookId &&
               user?.id &&
               !previousVisibleRef.current // Only call if player was previously closed
            ) {
               initializePlaybackSession({
                  userId: user.id,
                  audiobookId,
                  chapterId: currentChapterId,
               }).catch((error: unknown) => {
                  // Log error but don't block playback
                  console.error('[Audio Player] Failed to initialize playback session:', error);
               });
            }

            // Opening animation - set initial state for minimize/maximize views immediately
            // Set opacity synchronously before animation to ensure visibility
            if (isMinimized) {
               minimizedOpacity.value = 1;
               fullPlayerOpacity.value = 0;
            } else {
               fullPlayerOpacity.value = 1;
               minimizedOpacity.value = 0;
            }

            // Opening animation - animate from container height to 0
            translateY.value = withTiming(0, {
               duration: 350,
               easing: Easing.out(Easing.ease),
            });
            opacity.value = withTiming(1, {
               duration: 350,
               easing: Easing.out(Easing.ease),
            });
         } else {
            const bottomOffset = isMinimized ? minimizedBottomPosition : maximizedBottomPosition;
            const containerHeight = SCREEN_HEIGHT - bottomOffset;
            translateY.value = withTiming(containerHeight, {
               duration: 300,
               easing: Easing.in(Easing.ease),
            });
            opacity.value = withTiming(0, {
               duration: 300,
               easing: Easing.in(Easing.ease),
            });
         }
         previousVisibleRef.current = isVisible;
      }

      // Handle minimize/maximize animations
      if (isVisible && isMinimized !== previousMinimizedRef.current) {
         // CRITICAL: Reset dragY before starting minimize/maximize animations
         // This prevents conflicts between drag animation and minimize/maximize animations
         dragY.value = 0;

         // Ensure container opacity remains at 1 during minimize/maximize transitions
         // Container should only fade out when isVisible becomes false, not when minimizing
         opacity.value = 1;

         // When minimizing, ensure translateY is 0 (PiP window should not be translated)
         // When maximizing, translateY should already be 0 from open animation
         if (isMinimized) {
            translateY.value = 0;
         }

         if (isMinimized) {
            // Minimizing animation - fade out full player while fading in minimized player
            // Fade out full player
            fullPlayerOpacity.value = withTiming(0, {
               duration: 300,
               easing: Easing.out(Easing.ease),
            });
            // Fade in minimized player (Reanimated will use current value as start)
            minimizedOpacity.value = withTiming(1, {
               duration: 300,
               easing: Easing.out(Easing.ease),
            });
         } else {
            // Maximizing animation - fade out minimized player while fading in full player
            // Fade out minimized player
            minimizedOpacity.value = withTiming(0, {
               duration: 300,
               easing: Easing.out(Easing.ease),
            });
            // Fade in full player (Reanimated will use current value as start)
            fullPlayerOpacity.value = withTiming(1, {
               duration: 300,
               easing: Easing.out(Easing.ease),
            });
         }
         previousMinimizedRef.current = isMinimized;
      } else if (isVisible && isMinimized === previousMinimizedRef.current) {
         // Ensure opacity values are synchronized when player is visible but state hasn't changed
         // This is a safety check to ensure correct opacity values (e.g., after remount)
         // Also ensure container opacity stays at 1
         opacity.value = 1;

         // Ensure translateY is correct for current state
         if (isMinimized) {
            // When minimized, ensure translateY is 0 (PiP window should not be translated)
            translateY.value = 0;
            // When minimized, ensure minimized player is visible and full player is hidden
            minimizedOpacity.value = 1;
            fullPlayerOpacity.value = 0;
         } else {
            // When maximized, ensure translateY is 0 (full player should be visible)
            translateY.value = 0;
            // When maximized, ensure full player is visible and minimized player is hidden
            fullPlayerOpacity.value = 1;
            minimizedOpacity.value = 0;
         }
      }
   }, [isVisible, isMinimized, translateY, opacity, fullPlayerOpacity, minimizedOpacity, dragY, tabBarHeight, insets.bottom, maximizedBottomPosition, minimizedBottomPosition, hasBottomTabBar, audiobookId, currentChapterId, user?.id]);

   // Animated styles - must be called before early return (Rules of Hooks)
   const containerAnimatedStyle = useAnimatedStyle(() => {
      return {
         bottom: containerBottom.value,
         transform: [{ translateY: translateY.value }],
         opacity: opacity.value,
      };
   });

   const fullPlayerAnimatedStyle = useAnimatedStyle(() => {
      return {
         opacity: fullPlayerOpacity.value,
      };
   });

   const minimizedAnimatedStyle = useAnimatedStyle(() => {
      return {
         opacity: minimizedOpacity.value,
      };
   });


   // Don't render if not visible or no chapter or no playlist URI
   if (!isVisible || !currentChapterId || isUiSuppressed) {
      return null;
   }

   return (
      <Animated.View
         style={[
            styles.container,
            containerAnimatedStyle,
            {
               // When minimized: floating bar; when maximized: full-width card
               ...(isMinimized
                  ? {
                     left: playerFloatHorizontal,
                     right: playerFloatHorizontal,
                     backgroundColor: 'transparent',
                  }
                  : {
                     // Maximized: floating card anchored near screen bottom
                     left: playerFloatHorizontal,
                     right: playerFloatHorizontal,
                     backgroundColor: 'transparent',
                  }
               ),
               zIndex: 24,
               elevation: 24,
            }
         ]}
      >
         {isMinimized ? (
            <Animated.View
               style={[minimizedAnimatedStyle, styles.minimizedBarOuter]}
               pointerEvents="auto"
            >
               <TouchableOpacity
                  style={styles.minimizedBar}
                  onPress={handleExpand}
                  activeOpacity={0.92}
               >
                  <View style={styles.minimizedCoverWrap}>
                     {chapterCoverUri ? (
                        <Image
                           source={{ uri: chapterCoverUri }}
                           style={styles.minimizedCoverImage}
                           contentFit="cover"
                        />
                     ) : (
                        <View style={[styles.minimizedCoverImage, styles.minimizedCoverPlaceholder]}>
                           <Ionicons name="musical-notes" size={22} color={colors.text.secondary} />
                        </View>
                     )}
                  </View>

                  <View style={styles.minimizedInfo}>
                     <Text style={styles.minimizedTitle} numberOfLines={1}>
                        {chapterMetadata?.title || 'Loading...'}
                     </Text>
                     <Text style={styles.minimizedChapterMeta} numberOfLines={1}>
                        {minimizedChapterLabel}
                     </Text>
                     <Text style={styles.minimizedTimeText}>
                        {formatDuration(minimizedElapsed)} / {formatDuration(totalTime)}
                     </Text>
                     <View style={styles.minimizedProgressTrack}>
                        <View
                           style={[
                              styles.minimizedProgressFill,
                              { width: `${minimizedProgress * 100}%` },
                           ]}
                        />
                     </View>
                  </View>

                  <View style={styles.minimizedTrailingControls}>
                     <TouchableOpacity
                        onPress={(e) => {
                           e.stopPropagation();
                           handlePlayPause();
                        }}
                        style={styles.minimizedPlayControl}
                        activeOpacity={0.8}
                        disabled={isLoading}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                     >
                        {isLoading ? (
                           <ActivityIndicator size="small" color={colors.accent.primaryDark} />
                        ) : (
                           <Ionicons
                              name={isPlaying ? 'pause' : 'play'}
                              size={MINIMIZED_BAR.playIconSize}
                              color={colors.accent.primaryDark}
                              style={!isPlaying ? styles.playIconOffset : undefined}
                           />
                        )}
                     </TouchableOpacity>
                     <TouchableOpacity
                        onPress={(e) => {
                           e.stopPropagation();
                           handleClose();
                        }}
                        style={styles.minimizedCloseControl}
                        activeOpacity={0.7}
                        accessibilityLabel="Close player"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                     >
                        <Ionicons
                           name="close"
                           size={22}
                           color={colors.accent.primaryDark}
                        />
                     </TouchableOpacity>
                  </View>
               </TouchableOpacity>
            </Animated.View>
         ) : (
            <View style={styles.playerSheet}>
               <Animated.View
                  style={[
                     styles.playerContainer,
                     { height: fullPlayerLayout.maxHeight },
                     fullPlayerAnimatedStyle,
                     dragAnimatedStyle,
                  ]}
               >
                  {/* Top zone: drag handle + header — not inside ScrollView so pull-down works */}
                  <View
                     style={styles.dragMinimizeZone}
                     {...panResponder.panHandlers}
                     collapsable={false}
                  >
                     <View
                        style={styles.dragHandlerContainer}
                        pointerEvents="box-none"
                     >
                        <View style={styles.dragHandler} />
                     </View>

                     <View style={styles.header}>
                        <TouchableOpacity
                           onPress={handleClose}
                           style={styles.closeButton}
                           activeOpacity={0.7}
                           accessibilityLabel="Close player"
                        >
                           <Ionicons name="close" size={FP.headerMenuIconSize} color={colors.accent.primaryDark} />
                        </TouchableOpacity>
                     </View>
                  </View>

                  <ScrollView
                     style={styles.playerScrollContent}
                     contentContainerStyle={styles.playerScrollContentContainer}
                     showsVerticalScrollIndicator={false}
                     bounces={false}
                     nestedScrollEnabled
                  >
                     {/* Cover + chapter info */}
                     {chapterCoverUri && (
                        <View
                           style={[
                              styles.coverContainer,
                              {
                                 width: fullPlayerLayout.coverSize,
                                 height: fullPlayerLayout.coverSize,
                              },
                           ]}
                        >
                           <Image
                              source={{ uri: chapterCoverUri }}
                              style={styles.coverImage}
                              contentFit="cover"
                           />
                        </View>
                     )}
                     <Text style={styles.chapterLabel}>Chapter</Text>
                     <Text style={styles.chapterTitle} numberOfLines={2}>
                        {chapterMetadata?.title || 'Loading...'}
                     </Text>
                  </ScrollView>

                  <View style={styles.playerFixedFooter}>
                     <AudioPlayerSeekBar
                        duration={totalDuration}
                        position={playbackPosition}
                        endPosition={chapterEndPosition}
                        disabled={totalDuration <= 0 || isLoading}
                        onSeekStart={handleSeekStart}
                        onSeekEnd={handleSeekEnd}
                        onSeekComplete={handleSeekComplete}
                     />

                     {/* Controls */}
                     <View style={styles.controlsContainer}>
                     {error ? (
                        <View style={styles.errorContainer}>
                           <Text style={styles.errorText}>{error}</Text>
                           <TouchableOpacity
                              onPress={handlePlayPause}
                              style={styles.retryButton}
                           >
                              <Text style={styles.retryButtonText}>Retry</Text>
                           </TouchableOpacity>
                        </View>
                     ) : (
                        <View style={styles.controlsRow}>
                           <TouchableOpacity
                              onPress={() => void skipToPreviousChapter()}
                              style={styles.chapterButton}
                              activeOpacity={0.8}
                              disabled={isLoading}
                           >
                              <Ionicons
                                 name="play-skip-back"
                                 size={FP.chapterSkipIconSize}
                                 color={colors.accent.primaryDark}
                              />
                           </TouchableOpacity>

                           <TouchableOpacity
                              onPress={handleBackward}
                              style={styles.seekButton}
                              activeOpacity={0.8}
                              disabled={isLoading}
                           >
                              <Ionicons
                                 name="play-back-circle"
                                 size={FP.seekIconSize}
                                 color={colors.accent.primaryDark}
                              />
                              <Text style={styles.seekButtonText}>{skipDurationSeconds}s</Text>
                           </TouchableOpacity>

                           {/* Play/Pause Button */}
                           <TouchableOpacity
                              onPress={handlePlayPause}
                              style={styles.playButton}
                              activeOpacity={0.8}
                              disabled={isLoading}
                           >
                              {isLoading ? (
                                 <ActivityIndicator
                                    size="large"
                                    color={colors.accent.primaryDark}
                                 />
                              ) : (
                                 <View style={styles.iconWrapper}>
                                    <Ionicons
                                       name={isPlaying ? 'pause' : 'play'}
                                       size={FP.playIconSize}
                                       color="#FFFFFF"
                                       style={!isPlaying ? styles.playIconOffset : undefined}
                                    />
                                 </View>
                              )}
                           </TouchableOpacity>

                           <TouchableOpacity
                              onPress={handleForward}
                              style={styles.seekButton}
                              activeOpacity={0.8}
                              disabled={isLoading}
                           >
                              <Ionicons
                                 name="play-forward-circle"
                                 size={FP.seekIconSize}
                                 color={colors.accent.primaryDark}
                              />
                              <Text style={styles.seekButtonText}>{skipDurationSeconds}s</Text>
                           </TouchableOpacity>

                           <TouchableOpacity
                              onPress={() => void skipToNextChapter()}
                              style={styles.chapterButton}
                              activeOpacity={0.8}
                              disabled={isLoading}
                           >
                              <Ionicons
                                 name="play-skip-forward"
                                 size={FP.chapterSkipIconSize}
                                 color={colors.accent.primaryDark}
                              />
                           </TouchableOpacity>
                        </View>
                     )}
                     </View>

                     {/* Bottom action row */}
                     <View style={styles.bottomActionsDivider} />
                     <View style={styles.bottomActions}>
                     <TouchableOpacity
                        style={styles.bottomAction}
                        onPress={handleBookmarkPress}
                        activeOpacity={0.7}
                        disabled={
                           !currentChapterId ||
                           addBookmark.isPending ||
                           removeBookmark.isPending
                        }
                     >
                        <Ionicons
                           name={bookmark ? 'bookmark' : 'bookmark-outline'}
                           size={FP.bottomActionIconSize}
                           color={colors.accent.primaryDark}
                        />
                        <Text style={styles.bottomActionText}>Bookmark</Text>
                     </TouchableOpacity>
                     <TouchableOpacity style={styles.bottomAction} onPress={handleDiscussPress} activeOpacity={0.7}>
                        <Ionicons name="chatbubble-outline" size={FP.bottomActionIconSize} color={colors.accent.primaryDark} />
                        <Text style={styles.bottomActionText}>Discuss</Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                        style={styles.bottomAction}
                        onPress={() => setSpeedSheetVisible(true)}
                        activeOpacity={0.7}
                     >
                        <Ionicons
                           name="speedometer-outline"
                           size={FP.bottomActionIconSize}
                           color={colors.accent.primaryDark}
                        />
                        <Text style={styles.bottomActionText}>
                           {formatPlaybackSpeedLabel(playbackSpeed)}
                        </Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                        style={styles.bottomAction}
                        onPress={() => setSleepTimerSheetVisible(true)}
                        activeOpacity={0.7}
                     >
                        <Ionicons
                           name="moon-outline"
                           size={FP.bottomActionIconSize}
                           color={colors.accent.primaryDark}
                        />
                        <Text style={styles.bottomActionText}>{sleepTimerLabel}</Text>
                     </TouchableOpacity>
                     </View>
                  </View>
               </Animated.View>
            </View>
         )}

         <PlaybackSpeedSheet
            visible={speedSheetVisible}
            currentSpeed={playbackSpeed}
            onSelect={handleSpeedSelect}
            onClose={() => setSpeedSheetVisible(false)}
         />
         <SleepTimerSheet
            visible={sleepTimerSheetVisible}
            currentOption={sleepTimerOption}
            timerActive={sleepTimerActive}
            onSelect={handleSleepTimerSelect}
            onClose={() => setSleepTimerSheetVisible(false)}
         />
      </Animated.View>
   );
});

AudioPlayer.displayName = 'AudioPlayer';

