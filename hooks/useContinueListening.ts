/**
 * Resolves Continue Listening data from live player state, persisted playback, or API progress.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getChapterProgress } from '@/services/audiobooks';
import { ApiError } from '@/services/api';
import { queryKeys } from '@/constants/queryKeys';
import { RootState } from '@/store';
import { useAudiobook } from '@/hooks/useAudiobook';
import { useChapters } from '@/hooks/useChapters';
import {
   buildContinueListeningProgress,
   findMostRecentChapterProgress,
} from '@/utils/continueListening';
import {
   getPersistedPlaybackAudiobookId,
   getPersistedPlaybackChapterId,
} from '@/utils/playbackReturnPathStorage';
import { resolveAudiobookImageUrl } from '@/utils/imageAssets';
import { normalizeResourceId } from '@/utils/resourceId';

export interface ContinueListeningData {
   id: string;
   chapterId: string;
   title: string;
   author: string;
   coverUri?: string;
   chapterTitle: string;
   chapterNumber?: number;
   progress: number;
   elapsedSeconds: number;
   totalSeconds: number;
   /** True when the player already has this chapter loaded. */
   isLiveChapter: boolean;
}

export function useContinueListening() {
   const isAuthenticated = useSelector(
      (state: RootState) => state.auth.isAuthenticated
   );
   const isInitialized = useSelector(
      (state: RootState) => state.auth.isInitialized
   );
   const playerAudiobookId = useSelector((state: RootState) => state.player.audiobookId);
   const currentChapterId = useSelector(
      (state: RootState) => state.player.currentChapterId
   );
   const chapterMetadata = useSelector(
      (state: RootState) => state.player.chapterMetadata
   );
   const playbackPosition = useSelector(
      (state: RootState) => state.player.playbackPosition
   );
   const totalDuration = useSelector((state: RootState) => state.player.totalDuration);

   const [persistedAudiobookId, setPersistedAudiobookId] = useState<string | null>(null);
   const [persistedChapterId, setPersistedChapterId] = useState<string | null>(null);
   const [persistedLoaded, setPersistedLoaded] = useState(false);

   useEffect(() => {
      let cancelled = false;

      void (async () => {
         const [audiobookId, chapterId] = await Promise.all([
            getPersistedPlaybackAudiobookId(),
            getPersistedPlaybackChapterId(),
         ]);

         if (!cancelled) {
            setPersistedAudiobookId(audiobookId);
            setPersistedChapterId(chapterId);
            setPersistedLoaded(true);
         }
      })();

      return () => {
         cancelled = true;
      };
   }, []);

   const audiobookId = playerAudiobookId ?? persistedAudiobookId ?? null;

   const normalizedCurrentChapterId = normalizeResourceId(currentChapterId);
   const normalizedPersistedChapterId = normalizeResourceId(persistedChapterId);

   const liveChapterId =
      playerAudiobookId && playerAudiobookId === audiobookId
         ? normalizedCurrentChapterId
         : null;

   const candidateChapterId = liveChapterId ?? normalizedPersistedChapterId;

   const { data: audiobookData, isLoading: isAudiobookLoading, refetch: refetchAudiobook } = useAudiobook(
      audiobookId ?? ''
   );
   const { data: chaptersData, isLoading: isChaptersLoading, refetch: refetchChapters } = useChapters(
      audiobookId ?? ''
   );

   const chapters = useMemo(() => chaptersData?.data ?? [], [chaptersData?.data]);

   const {
      data: discoveredChapter,
      isLoading: isDiscoveringChapter,
      refetch: refetchDiscoveredChapter,
   } = useQuery({
      queryKey: queryKeys.playback.continueListeningDiscover(audiobookId ?? ''),
      queryFn: () => findMostRecentChapterProgress(chapters),
      enabled:
         persistedLoaded &&
         isAuthenticated &&
         isInitialized &&
         !!audiobookId &&
         !candidateChapterId &&
         chapters.length > 0,
   });

   const resolvedChapterId =
      candidateChapterId ?? discoveredChapter?.chapterId ?? null;

   const useLiveProgress =
      !!resolvedChapterId &&
      resolvedChapterId === normalizedCurrentChapterId &&
      playerAudiobookId === audiobookId &&
      playbackPosition > 0;

   const {
      data: savedProgress,
      isLoading: isProgressLoading,
      refetch: refetchSavedProgress,
   } = useQuery({
      queryKey: queryKeys.playback.chapterProgress(resolvedChapterId ?? ''),
      queryFn: async () => {
         const progress = await getChapterProgress(resolvedChapterId!);
         return progress?.currentPosition ?? 0;
      },
      enabled:
         persistedLoaded &&
         isAuthenticated &&
         isInitialized &&
         !!resolvedChapterId &&
         !useLiveProgress,
      retry: (failureCount, error) => {
         if (error instanceof ApiError && error.status === 404) {
            return false;
         }
         return failureCount < 2;
      },
   });

   const chapterFromList = useMemo(
      () => chapters.find((chapter) => chapter.id === resolvedChapterId),
      [chapters, resolvedChapterId]
   );

   const data = useMemo((): ContinueListeningData | null => {
      if (!audiobookId || !resolvedChapterId) {
         return null;
      }

      const book = audiobookData?.data;
      const chapter = chapterFromList ?? discoveredChapter?.chapter;

      const chapterTitle =
         (useLiveProgress && chapterMetadata?.title) ||
         chapter?.title ||
         chapterMetadata?.title ||
         '';

      const chapterNumber =
         (useLiveProgress && chapterMetadata?.chapterNumber) ||
         chapter?.chapterNumber ||
         chapterMetadata?.chapterNumber;

      const elapsedSeconds = useLiveProgress
         ? playbackPosition
         : savedProgress ?? discoveredChapter?.currentPosition ?? 0;

      const totalSeconds =
         useLiveProgress && totalDuration > 0
            ? totalDuration
            : chapter?.duration ?? totalDuration;

      if (elapsedSeconds <= 0 && !liveChapterId) {
         return null;
      }

      const title = book?.title ?? chapter?.audiobook?.title ?? chapterMetadata?.audiobookTitle ?? '';
      const author = book?.author ?? chapter?.audiobook?.author ?? '';
      const coverUri = book
         ? resolveAudiobookImageUrl(book, 'continueListening')
         : undefined;

      return {
         id: audiobookId,
         chapterId: resolvedChapterId,
         title,
         author,
         coverUri,
         chapterTitle,
         chapterNumber,
         progress: buildContinueListeningProgress(elapsedSeconds, totalSeconds),
         elapsedSeconds,
         totalSeconds,
         isLiveChapter: liveChapterId === resolvedChapterId,
      };
   }, [
      audiobookId,
      resolvedChapterId,
      audiobookData?.data,
      chapterFromList,
      discoveredChapter,
      useLiveProgress,
      chapterMetadata,
      playbackPosition,
      savedProgress,
      totalDuration,
      liveChapterId,
   ]);

   const isLoading =
      !persistedLoaded ||
      (!!audiobookId &&
         (isAudiobookLoading ||
            isChaptersLoading ||
            isDiscoveringChapter ||
            isProgressLoading));

   const refetch = useCallback(async () => {
      await Promise.all([
         refetchAudiobook(),
         refetchChapters(),
         refetchDiscoveredChapter(),
         refetchSavedProgress(),
      ]);
   }, [
      refetchAudiobook,
      refetchChapters,
      refetchDiscoveredChapter,
      refetchSavedProgress,
   ]);

   return { data, isLoading, refetch };
}
