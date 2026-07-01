import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
   runOnJS,
   useAnimatedReaction,
   useAnimatedStyle,
   useSharedValue,
} from 'react-native-reanimated';
import {
   getMaxSeekableProgress,
   getPlaybackRemainingSeconds,
   progressToSeekSeconds,
} from '@/utils/playbackPosition';
import { formatDuration } from '@/utils/duration';
import { spacing, typography, borderRadius } from '@/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

const PROGRESS_BAR_HEIGHT = 5;
const PROGRESS_HANDLE_SIZE = 20;
const PROGRESS_HANDLE_CENTER_OFFSET = PROGRESS_HANDLE_SIZE / 2;
const PROGRESS_HANDLE_TOP = -(PROGRESS_HANDLE_CENTER_OFFSET - PROGRESS_BAR_HEIGHT / 2);
const PROGRESS_TOUCH_MIN_HEIGHT = 52;
const PROGRESS_BAR_HORIZONTAL_PADDING = 10;
const TIME_TEXT_SIZE = typography.fontSize.base;

function touchXToClampedProgress(
   touchX: number,
   barWidth: number,
   maxProgress: number
): number {
   'worklet';
   if (barWidth <= 0) {
      return 0;
   }
   const raw = Math.max(0, Math.min(1, touchX / barWidth));
   return Math.max(0, Math.min(maxProgress, raw));
}

export interface AudioPlayerSeekBarProps {
   duration: number;
   position: number;
   /** Max seek position (seconds) from GET /chapters/:id — caps scrubbing */
   endPosition?: number | null;
   disabled?: boolean;
   onSeekStart: () => void;
   onSeekEnd: () => void;
   /** Called when the user releases; may return a Promise (e.g. await TrackPlayer seek). */
   onSeekComplete: (seconds: number) => void | Promise<void>;
}

export const AudioPlayerSeekBar: React.FC<AudioPlayerSeekBarProps> = ({
   duration,
   position,
   endPosition = null,
   disabled = false,
   onSeekStart,
   onSeekEnd,
   onSeekComplete,
}) => {
   const styles = useThemedStyles((t) =>
      StyleSheet.create({
         progressContainer: {
            marginBottom: spacing.md,
         },
         progressBarWrapper: {
            marginBottom: spacing.xs,
            paddingVertical: spacing.sm,
            paddingHorizontal: PROGRESS_BAR_HORIZONTAL_PADDING,
         },
         progressBarContainer: {
            position: 'relative',
            width: '100%',
            minHeight: PROGRESS_TOUCH_MIN_HEIGHT,
            justifyContent: 'center',
         },
         progressBarTrack: {
            position: 'relative',
            width: '100%',
            height: PROGRESS_BAR_HEIGHT,
         },
         progressBar: {
            height: PROGRESS_BAR_HEIGHT,
            backgroundColor: t.colors.border.light,
            borderRadius: borderRadius.sm,
            overflow: 'hidden',
            width: '100%',
         },
         progressFill: {
            height: '100%',
            backgroundColor: t.colors.accent.primary,
         },
         progressHandle: {
            position: 'absolute',
            width: PROGRESS_HANDLE_SIZE,
            height: PROGRESS_HANDLE_SIZE,
            borderRadius: PROGRESS_HANDLE_SIZE / 2,
            backgroundColor: t.colors.accent.primary,
            top: PROGRESS_HANDLE_TOP,
            ...Platform.select({
               ios: {
                  shadowColor: '#ffffff',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.6,
                  shadowRadius: 8,
               },
               android: {
                  elevation: 5,
               },
            }),
         },
         timeContainer: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            paddingHorizontal: PROGRESS_BAR_HORIZONTAL_PADDING,
         },
         timeText: {
            fontSize: TIME_TEXT_SIZE,
            color: t.colors.text.secondaryDark,
            ...Platform.select({
               ios: { fontFamily: 'System', fontWeight: '400' },
               android: { fontFamily: 'sans-serif' },
            }),
         },
      })
   );

   const onSeekStartRef = useRef(onSeekStart);
   const onSeekEndRef = useRef(onSeekEnd);
   const onSeekCompleteRef = useRef(onSeekComplete);
   onSeekStartRef.current = onSeekStart;
   onSeekEndRef.current = onSeekEnd;
   onSeekCompleteRef.current = onSeekComplete;

   const seekInFlightRef = useRef(false);
   const seekCommittedShared = useSharedValue(false);

   const barWidthShared = useSharedValue(0);
   const durationShared = useSharedValue(duration);
   const endPositionShared = useSharedValue(endPosition ?? 0);
   const maxProgressShared = useSharedValue(
      getMaxSeekableProgress(duration, endPosition)
   );
   const positionShared = useSharedValue(0);
   /** Single source of truth for fill/handle position — avoids isScrubbing ? a : b flicker. */
   const visualProgress = useSharedValue(0);
   const isScrubbing = useSharedValue(false);

   useEffect(() => {
      durationShared.value = duration;
      endPositionShared.value = endPosition ?? 0;
      maxProgressShared.value = getMaxSeekableProgress(duration, endPosition);
   }, [duration, endPosition, durationShared, endPositionShared, maxProgressShared]);

   useEffect(() => {
      positionShared.value = duration > 0 ? position / duration : 0;
   }, [position, duration, positionShared]);

   // Sync playback progress to the thumb only when not scrubbing (UI thread).
   useAnimatedReaction(
      () => ({
         progress: positionShared.value,
         scrubbing: isScrubbing.value,
      }),
      (current) => {
         if (!current.scrubbing) {
            visualProgress.value = current.progress;
         }
      }
   );

   const setScrubbing = useCallback(
      (active: boolean) => {
         isScrubbing.value = active;
      },
      [isScrubbing]
   );

   const handleSeekStart = useCallback(() => {
      setScrubbing(true);
      onSeekStartRef.current();
   }, [setScrubbing]);

   const handleSeekEnd = useCallback(() => {
      setScrubbing(false);
      onSeekEndRef.current();
   }, [setScrubbing]);

   const handleSeekComplete = useCallback(
      async (progress: number, durationSeconds: number) => {
         if (seekInFlightRef.current) {
            return;
         }
         seekInFlightRef.current = true;
         seekCommittedShared.value = true;
         visualProgress.value = progress;

         try {
            const seconds = progressToSeekSeconds(
               progress,
               durationSeconds,
               endPositionShared.value > 0 ? endPositionShared.value : null
            );
            await Promise.resolve(onSeekCompleteRef.current(seconds));
         } finally {
            seekInFlightRef.current = false;
            seekCommittedShared.value = false;
            handleSeekEnd();
         }
      },
      [handleSeekEnd, seekCommittedShared, visualProgress, endPositionShared]
   );

   // Tap-to-seek: no pan onBegin, so no cancel/revert flicker.
   const tapGesture = Gesture.Tap()
      .enabled(!disabled && duration > 0)
      .onEnd((event) => {
         const progress = touchXToClampedProgress(
            event.x,
            barWidthShared.value,
            maxProgressShared.value
         );
         isScrubbing.value = true;
         visualProgress.value = progress;
         runOnJS(handleSeekStart)();
         runOnJS(handleSeekComplete)(progress, durationShared.value);
      });

   // Drag-to-scrub: onStart fires only after the pan activates (horizontal move).
   const panGesture = Gesture.Pan()
      .enabled(!disabled && duration > 0)
      .activeOffsetX([-8, 8])
      .failOffsetY([-12, 12])
      .hitSlop({ top: 16, bottom: 16, left: 0, right: 0 })
      .onStart((event) => {
         const progress = touchXToClampedProgress(
            event.x,
            barWidthShared.value,
            maxProgressShared.value
         );
         isScrubbing.value = true;
         visualProgress.value = progress;
         runOnJS(handleSeekStart)();
      })
      .onUpdate((event) => {
         visualProgress.value = touchXToClampedProgress(
            event.x,
            barWidthShared.value,
            maxProgressShared.value
         );
      })
      .onEnd((event) => {
         const progress = touchXToClampedProgress(
            event.x,
            barWidthShared.value,
            maxProgressShared.value
         );
         visualProgress.value = progress;
         runOnJS(handleSeekComplete)(progress, durationShared.value);
      })
      .onFinalize((_event, success) => {
         if (success || seekCommittedShared.value) {
            return;
         }
         runOnJS(handleSeekEnd)();
      });

   const seekGesture = Gesture.Exclusive(panGesture, tapGesture);

   const progressFillStyle = useAnimatedStyle(() => {
      const width = barWidthShared.value;
      return {
         width: width > 0 ? visualProgress.value * width : 0,
      };
   });

   const progressHandleStyle = useAnimatedStyle(() => {
      const width = barWidthShared.value;
      return {
         left:
            width > 0
               ? visualProgress.value * width - PROGRESS_HANDLE_CENTER_OFFSET
               : -PROGRESS_HANDLE_CENTER_OFFSET,
      };
   });

   const remainingTime = getPlaybackRemainingSeconds(position, duration, endPosition);

   return (
      <View style={styles.progressContainer}>
         <View style={styles.progressBarWrapper}>
            <GestureDetector gesture={seekGesture}>
               <View
                  style={styles.progressBarContainer}
                  onLayout={(event) => {
                     const width = event.nativeEvent.layout.width;
                     if (width > 0) {
                        barWidthShared.value = width;
                     }
                  }}
               >
                  <View style={styles.progressBarTrack}>
                     <View style={styles.progressBar}>
                        <Animated.View style={[styles.progressFill, progressFillStyle]} />
                     </View>
                     <Animated.View style={[styles.progressHandle, progressHandleStyle]} />
                  </View>
               </View>
            </GestureDetector>
         </View>
         <View style={styles.timeContainer}>
            <Text style={styles.timeText}>
               {remainingTime > 0 ? `-${formatDuration(remainingTime)}` : formatDuration(0)}
            </Text>
         </View>
      </View>
   );
};
