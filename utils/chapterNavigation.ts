/**
 * Chapter navigation — auto-advance, lock screen next/prev, in-app controls.
 */

import TrackPlayer from 'react-native-track-player';
import type { AppDispatch } from '@/store';
import { store } from '@/store';
import { stop } from '@/store/player';
import { getChapters, type Chapter } from '@/services/audiobooks';
import { openChapterForPlayback } from '@/utils/openChapterForPlayback';
import { requestChapterReload } from '@/services/playbackReload';
import { markChapterCompletedAtEnd } from '@/utils/markChapterCompletedAtEnd';
import { queryKeys } from '@/constants/queryKeys';
import { queryClient } from '@/utils/queryClient';

export async function fetchAllChapters(audiobookId: string): Promise<Chapter[]> {
   const allChapters: Chapter[] = [];
   let page = 1;
   let hasNextPage = true;

   while (hasNextPage) {
      const response = await getChapters(audiobookId, page);
      allChapters.push(...response.data);

      if (response.pagination) {
         hasNextPage = response.pagination.hasNextPage;
         page++;
      } else {
         hasNextPage = false;
      }
   }

   allChapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
   return allChapters;
}

export async function getCachedOrFetchAllChapters(audiobookId: string): Promise<Chapter[]> {
   return queryClient.fetchQuery({
      queryKey: queryKeys.audiobooks.chaptersAll(audiobookId),
      queryFn: () => fetchAllChapters(audiobookId),
   });
}

function totalDurationFromCachedPlaylist(chapterId: string): number | undefined {
   const cached = store.getState().streaming.playlistsByChapterId[chapterId];
   if (!cached) {
      return undefined;
   }
   return cached.playlist.segments.reduce((sum, segment) => sum + segment.duration, 0);
}

export async function getAdjacentChapter(
   audiobookId: string,
   currentChapterId: string,
   offset: 1 | -1
): Promise<Chapter | null> {
   const allChapters = await getCachedOrFetchAllChapters(audiobookId);
   const currentIndex = allChapters.findIndex((c) => c.id === currentChapterId);
   if (currentIndex === -1) {
      return null;
   }
   const targetIndex = currentIndex + offset;
   if (targetIndex < 0 || targetIndex >= allChapters.length) {
      return null;
   }
   return allChapters[targetIndex] ?? null;
}

export async function switchToChapter(
   dispatch: AppDispatch,
   chapter: Chapter,
   options?: {
      onChapterSwitched?: (chapterId: string) => void;
      totalChapters?: number;
      startFromBeginning?: boolean;
   }
): Promise<void> {
   const totalDurationSeconds = totalDurationFromCachedPlaylist(chapter.id);

   await openChapterForPlayback({
      chapter,
      dispatch,
      totalChapters: options?.totalChapters,
      totalDurationSeconds,
      autoPlay: true,
      startFromBeginning: options?.startFromBeginning,
   });
   requestChapterReload();
   options?.onChapterSwitched?.(chapter.id);
}

export interface AdvanceToNextChapterParams {
   dispatch: AppDispatch;
   audiobookId: string;
   currentChapterId: string;
   isVisible: boolean;
   totalDuration: number;
   onChapterSwitched?: (chapterId: string) => void;
}

export interface FinalizeAudiobookPlaybackParams {
   dispatch: AppDispatch;
   audiobookId: string;
   currentChapterId: string;
   totalDuration: number;
}

/** Stop playback at the last chapter — never loop back to chapter 1. */
export async function finalizeAudiobookPlayback(
   params: FinalizeAudiobookPlaybackParams
): Promise<void> {
   const { dispatch, audiobookId, currentChapterId, totalDuration } = params;

   try {
      await TrackPlayer.pause();
   } catch (error: unknown) {
      console.warn('[Chapter Navigation] Failed to pause at book end:', error);
   }

   await markChapterCompletedAtEnd(
      audiobookId,
      currentChapterId,
      totalDuration,
      totalDuration
   );

   dispatch(stop());
}

export async function advanceToNextChapter(params: AdvanceToNextChapterParams): Promise<void> {
   const { dispatch, audiobookId, currentChapterId, totalDuration, onChapterSwitched } =
      params;

   try {
      const allChapters = await getCachedOrFetchAllChapters(audiobookId);
      const nextChapter = await getAdjacentChapter(audiobookId, currentChapterId, 1);

      if (nextChapter) {
         await markChapterCompletedAtEnd(
            audiobookId,
            currentChapterId,
            totalDuration,
            totalDuration
         );
         await switchToChapter(dispatch, nextChapter, {
            onChapterSwitched,
            totalChapters: allChapters.length,
            startFromBeginning: true,
         });
         return;
      }

      await finalizeAudiobookPlayback({
         dispatch,
         audiobookId,
         currentChapterId,
         totalDuration,
      });
   } catch (error) {
      console.error('[Chapter Navigation] Error advancing:', error);
      await finalizeAudiobookPlayback({
         dispatch,
         audiobookId,
         currentChapterId,
         totalDuration,
      });
   }
}

export async function skipToNextChapterRemote(
   dispatch: AppDispatch,
   audiobookId: string,
   currentChapterId: string,
   onChapterSwitched?: (chapterId: string) => void
): Promise<void> {
   const allChapters = await getCachedOrFetchAllChapters(audiobookId);
   const next = await getAdjacentChapter(audiobookId, currentChapterId, 1);
   if (next) {
      await switchToChapter(dispatch, next, {
         onChapterSwitched,
         totalChapters: allChapters.length,
      });
   }
}

export async function skipToPreviousChapterRemote(
   dispatch: AppDispatch,
   audiobookId: string,
   currentChapterId: string,
   onChapterSwitched?: (chapterId: string) => void
): Promise<void> {
   const allChapters = await getCachedOrFetchAllChapters(audiobookId);
   const prev = await getAdjacentChapter(audiobookId, currentChapterId, -1);
   if (prev) {
      await switchToChapter(dispatch, prev, {
         onChapterSwitched,
         totalChapters: allChapters.length,
      });
   }
}
