/**
 * One-time React Native Track Player setup and capability options.
 * Kept separate from playback event handlers to avoid require cycles.
 */

import TrackPlayer, {
   AppKilledPlaybackBehavior,
   Capability,
   RatingType,
   RepeatMode,
} from 'react-native-track-player';
import { Platform } from 'react-native';
import { ensureMediaNotificationPermission } from '@/utils/ensureMediaNotificationPermission';
import {
   DEFAULT_PLAYBACK_SPEED,
   formatPlaybackSpeedLabel,
   type PlaybackSpeed,
} from '@/constants/playbackSpeed';

let setupPromise: Promise<void> | null = null;

export async function setupTrackPlayerOnce(): Promise<void> {
   if (setupPromise) {
      return setupPromise;
   }

   setupPromise = (async () => {
      if (Platform.OS === 'android') {
         await ensureMediaNotificationPermission();
      }
      await TrackPlayer.setupPlayer({
         autoUpdateMetadata: true,
      });
   })();
   return setupPromise;
}

export function resetTrackPlayerSetup(): void {
   setupPromise = null;
}

export async function updateTrackPlayerOptions(
   skipDurationSeconds: number,
   playbackSpeed: PlaybackSpeed = DEFAULT_PLAYBACK_SPEED
): Promise<void> {
   await setupTrackPlayerOnce();

   const speedLabel = formatPlaybackSpeedLabel(playbackSpeed);

   const baseCapabilities = [
      Capability.Play,
      Capability.Pause,
      Capability.SeekTo,
      Capability.JumpForward,
      Capability.JumpBackward,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
   ];

   const androidCapabilities = [...baseCapabilities, Capability.SetRating];

   await TrackPlayer.updateOptions({
      capabilities: Platform.OS === 'android' ? androidCapabilities : baseCapabilities,
      notificationCapabilities:
         Platform.OS === 'android' ? androidCapabilities : baseCapabilities,
      compactCapabilities: [
         Capability.Play,
         Capability.JumpForward,
         Capability.JumpBackward,
      ],
      forwardJumpInterval: skipDurationSeconds,
      backwardJumpInterval: skipDurationSeconds,
      progressUpdateEventInterval: 1,
      ratingType: Platform.OS === 'android' ? RatingType.Heart : undefined,
      likeOptions: {
         title: speedLabel,
         isActive: playbackSpeed !== 1,
      },
      dislikeOptions: {
         title: 'Slower',
         isActive: false,
      },
      android: {
         appKilledPlaybackBehavior:
            AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
         alwaysPauseOnInterruption: true,
         stopForegroundGracePeriod: 5,
      },
      ...(Platform.OS === 'android'
         ? {
              color: 0xffe53935,
           }
         : {}),
   });

   await TrackPlayer.setRepeatMode(RepeatMode.Off);
}
