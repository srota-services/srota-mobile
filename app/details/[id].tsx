import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
   View,
   Text,
   StyleSheet,
   Platform,
   FlatList,
   ScrollView,
   ActivityIndicator,
   TouchableOpacity,
   RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useSelector } from 'react-redux';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/constants/queryKeys';
import { RootState } from '@/store';
import { APP_BACK_ICON, APP_BACK_ICON_SIZE } from '@/constants/navigationIcons';
import { typography, spacing, borderRadius } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { Chapter, getChapters, initializePlaybackSession } from '@/services/audiobooks';
import { useAudiobook } from '@/hooks/useAudiobook';
import { useNotFoundRedirect } from '@/hooks/useNotFoundRedirect';
import { useStreamingPlaylist } from '@/hooks/useStreamingPlaylist';
import { ChapterListItem } from '@/components/ChapterListItem';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { SkeletonChapterRow, SkeletonDetailsHeader, SkeletonDetailsAbout } from '@/components/skeleton';
import { TabUnderline } from '@/components/TabUnderline';
import { TabSlideView } from '@/components/TabSlideView';
import { formatDuration } from '@/utils/duration';
import { canAccessChapter, getChapterListSyncSignature } from '@/utils/chapterAccess';
import { resolveAudiobookImageUrl } from '@/utils/imageAssets';
import { useDispatch } from 'react-redux';
import { setTotalDuration, play } from '@/store/player';
import { useChaptersProgress } from '@/hooks/useChaptersProgress';
import { openChapterForPlayback } from '@/utils/openChapterForPlayback';
import { requestChapterReload } from '@/services/playbackReload';
import { getMinimizedPlayerScrollPadding } from '@/theme/tabLayout';
import { StarRating } from '@/components/StarRating';
import { useFavorite, useFavoriteMutations } from '@/hooks/useFavorite';
import { useReviewMutation } from '@/hooks/useReviewMutation';
import { AddToPlaylistSheet } from '@/components/AddToPlaylistSheet';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

export default function DetailsScreen() {
   const { colors } = useTheme();
   const styles = useThemedStyles((t) =>
      StyleSheet.create({
   container: {
      flex: 1,
      backgroundColor: t.colors.background.screen,
   },
   bookHeaderWrapper: {
      flexShrink: 0,
   },
   tabSlideContainer: {
      flex: 1,
   },
   topActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
   },
   topActionsRight: {
      flexDirection: 'row',
      alignItems: 'center',
   },
   topIconButton: {
      padding: spacing.xs,
      marginLeft: spacing.xs,
   },
   bookRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
   },
   bookCover: {
      width: 88,
      height: 88,
      borderRadius: borderRadius.lg,
      marginRight: spacing.md,
   },
   bookCoverPlaceholder: {
      backgroundColor: t.colors.background.highlight,
      alignItems: 'center',
      justifyContent: 'center',
   },
   bookInfo: {
      flex: 1,
      justifyContent: 'center',
   },
   bookAuthor: {
      fontSize: typography.fontSize.sm,
      color: t.colors.text.secondary,
      marginTop: spacing.xs,
   },
   ratingRow: {
      flexDirection: 'row',
      marginTop: spacing.xs,
      gap: 2,
   },
   bookMeta: {
      fontSize: typography.fontSize.xs,
      color: t.colors.text.muted,
      marginTop: spacing.xs,
   },
   actionButtons: {
      flexDirection: 'row',
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
      marginBottom: spacing.md,
   },
   playBtn: {
      flex: 1,
   },
   downloadBtn: {
      flex: 1,
   },
   aboutSection: {
      padding: spacing.md,
   },
   aboutEmpty: {
      fontSize: typography.fontSize.base,
      color: t.colors.text.secondary,
      lineHeight: 22,
   },
   aboutDescription: {
      fontSize: typography.fontSize.base,
      color: t.colors.text.primary,
      lineHeight: 22,
   },
   scrollContent: {
      // Base padding - will be overridden by dynamic padding based on player visibility
   },
   backButtonContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      paddingTop: Platform.OS === 'ios' ? 50 : 20,
      paddingLeft: spacing.md,
      paddingRight: spacing.md,
   },
   backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      ...Platform.select({
         ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
         },
         android: {
            elevation: 5,
         },
      }),
   },
   coverContainer: {
      width: '100%',
      height: 300,
      backgroundColor: t.colors.background.darkGray,
   },
   coverImage: {
      width: '100%',
      height: '100%',
   },
   coverPlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
   },
   infoSection: {
      padding: spacing.lg,
      backgroundColor: t.colors.background.dark,
   },
   titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
      gap: spacing.md,
   },
   audiobookTitle: {
      fontSize: typography.fontSize.lg,
      color: t.colors.text.primary,
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
   genreBanner: {
      backgroundColor: t.colors.app.red,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.md,
      flexShrink: 0,
   },
   genreText: {
      fontSize: typography.fontSize.sm,
      color: t.colors.text.dark,
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
   genresContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
   },
   genreChip: {
      backgroundColor: t.colors.primary[100],
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.lg,
   },
   genreChipText: {
      fontSize: typography.fontSize.sm,
      color: t.colors.accent.primary,
      fontWeight: '600',
      ...Platform.select({
         ios: {
            fontFamily: 'System',
            fontWeight: '500',
         },
         android: {
            fontFamily: 'sans-serif-medium',
         },
      }),
   },
   narrators: {
      fontSize: typography.fontSize.base,
      color: t.colors.text.secondaryDark,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
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
   metaDropdownContainer: {
      marginTop: spacing.md,
      overflow: 'hidden',
      alignItems: 'center',
      width: '100%',
   },
   metaDropdownButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      backgroundColor: t.colors.app.red,
      borderRadius: borderRadius.md,
      marginBottom: spacing.xs,
      alignSelf: 'center',
   },
   metaDropdownButtonText: {
      fontSize: typography.fontSize.base,
      color: t.colors.text.dark,
      fontWeight: '500',
      marginRight: spacing.xs,
      ...Platform.select({
         ios: {
            fontFamily: 'System',
            fontWeight: '500',
         },
         android: {
            fontFamily: 'sans-serif-medium',
         },
      }),
   },
   metaContent: {
      width: '100%',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      backgroundColor: t.colors.neutral[800],
      borderRadius: borderRadius.md,
      overflow: 'hidden',
      marginTop: spacing.xs,
   },
   metaEntry: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: spacing.sm,
      gap: spacing.sm,
   },
   metaKey: {
      fontSize: typography.fontSize.sm,
      color: t.colors.text.secondaryDark,
      fontWeight: '600',
      minWidth: 100,
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
   metaValueText: {
      fontSize: typography.fontSize.sm,
      color: t.colors.text.dark,
      flex: 1,
      textAlign: 'left',
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
   description: {
      fontSize: typography.fontSize.sm,
      color: t.colors.text.secondary,
      lineHeight: 20,
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
   metaContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
   },
   metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
   },
   metaLabel: {
      fontSize: typography.fontSize.sm,
      color: t.colors.text.secondaryDark,
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
   metaValue: {
      fontSize: typography.fontSize.sm,
      color: t.colors.text.dark,
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
   chaptersSection: {
      backgroundColor: t.colors.background.dark,
      paddingTop: spacing.md,
   },
   chaptersTitle: {
      fontSize: typography.fontSize.xl,
      fontWeight: '600',
      color: t.colors.text.dark,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
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
   upgradeSection: {
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
      alignItems: 'center',
   },
   upgradeSectionContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      paddingHorizontal: spacing.md,
   },
   scrollContentRestricted: {
      flexGrow: 1,
   },
   restrictedTabList: {
      flex: 1,
   },
   upgradeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: spacing.xs,
      backgroundColor: t.colors.app.red,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      ...Platform.select({
         ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 3,
         },
         android: {
            elevation: 5,
         },
      }),
   },
   upgradeBadgeText: {
      fontSize: typography.fontSize.base,
      color: t.colors.primary[50],
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
   upgradeMessage: {
      fontSize: typography.fontSize.sm,
      color: t.colors.text.secondaryDark,
      textAlign: 'center',
      lineHeight: typography.lineHeight.relaxed * typography.fontSize.sm,
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
   emptyContainer: {
      padding: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 200,
   },
   emptyText: {
      fontSize: typography.fontSize.base,
      color: t.colors.text.secondaryDark,
      textAlign: 'center',
      marginTop: spacing.md,
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
   errorText: {
      fontSize: typography.fontSize.base,
      color: t.colors.app.red,
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
   footerLoader: {
      padding: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
   },
   bottomNavBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: t.colors.background.darkGray,
      height: Platform.OS === 'ios' ? 90 : 70,
      paddingTop: Platform.OS === 'ios' ? 10 : 5,
      paddingBottom: Platform.OS === 'ios' ? 30 : 10,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      zIndex: 100, // Below AudioPlayer (zIndex 1000) but above content
      elevation: 100, // Android elevation (below AudioPlayer elevation 1000)
      ...Platform.select({
         ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
         },
         android: {
            elevation: 3,
         },
      }),
   },
   navItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xs,
   },
   navLabel: {
      fontSize: typography.fontSize.xs,
      fontWeight: '500',
      marginTop: 4,
      color: t.colors.text.secondaryDark,
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
      })
   );

   const { id, autoPlay, chapterId } = useLocalSearchParams<{
      id: string;
      autoPlay?: string;
      chapterId?: string;
   }>();
   const [currentPage, setCurrentPage] = useState(1);
   const insets = useSafeAreaInsets();
   const [allChapters, setAllChapters] = useState<Chapter[]>([]);
   const [pagination, setPagination] = useState<{
      hasNextPage: boolean;
      currentPage: number;
      totalPages: number;
   } | null>(null);
   const paginationLoadingRef = useRef(false);
   const clickedChapterIdRef = useRef<string | null>(null);
   const dispatch = useDispatch();
   const [detailTab, setDetailTab] = useState<'chapters' | 'about'>('chapters');
   const [hasSubmittedReview, setHasSubmittedReview] = useState(false);
   const [playlistSheetVisible, setPlaylistSheetVisible] = useState(false);

   const isAuthenticated = useSelector(
      (state: RootState) => state.auth.isAuthenticated
   );
   const isInitialized = useSelector(
      (state: RootState) => state.auth.isInitialized
   );

   // Get player visibility state to calculate proper padding and for "Now Playing" badge
   const isPlayerVisible = useSelector(
      (state: RootState) => state.player.isVisible
   );

   // Scroll padding: details has no tab bar; add space only for minimized player when visible
   const scrollContentStyle = useMemo(() => {
      const paddingBottom = isPlayerVisible
         ? getMinimizedPlayerScrollPadding(insets.bottom)
         : insets.bottom + spacing.lg;

      return { paddingBottom };
   }, [isPlayerVisible, insets.bottom]);

   const queryClient = useQueryClient();

   // Fetch audiobook data
   const {
      data: audiobookData,
      isLoading: isAudiobookLoading,
      isNotFound,
      refetch: refetchAudiobook,
      isRefetching: isAudiobookRefetching,
   } = useAudiobook(id || '');
   useNotFoundRedirect(isNotFound, 'This audiobook is no longer available.');

   const audiobook = audiobookData?.data;

   const { data: favorite, refetch: refetchFavorite, isRefetching: isFavoriteRefetching } =
      useFavorite(id || '');
   const { add: addFavorite, remove: removeFavorite } = useFavoriteMutations(id || '');
   const reviewMutation = useReviewMutation(id || '');

   const aggregateRating = audiobook?.rating ?? 0;
   const canRate =
      !hasSubmittedReview &&
      !reviewMutation.isPending &&
      aggregateRating === 0;

   const handleFavoritePress = useCallback(() => {
      if (!id || addFavorite.isPending || removeFavorite.isPending) return;
      if (favorite) {
         removeFavorite.mutate(favorite.id);
      } else {
         addFavorite.mutate();
      }
   }, [id, favorite, addFavorite, removeFavorite]);

   const handleRate = useCallback(
      (rating: number) => {
         if (!canRate || !id) return;
         reviewMutation.mutate(rating, {
            onSuccess: () => setHasSubmittedReview(true),
         });
      },
      [canRate, id, reviewMutation]
   );

   const isAccessRestricted = audiobook?.subscriptionAccess?.canAccess === false;
   const shouldFetchChapters = !!audiobook && !isAccessRestricted;

   const upgradeMessage = audiobook?.subscriptionAccess?.message;

   // Create query options for all pages up to currentPage
   const chapterQueryOptions = useMemo(() => {
      if (!id || !isAuthenticated || !isInitialized || !shouldFetchChapters) {
         return [];
      }

      const options = [];
      for (let page = 1; page <= currentPage; page++) {
         options.push({
            queryKey: queryKeys.audiobooks.chapters(id, page),
            queryFn: () => getChapters(id, page),
            enabled: true,
         });
      }
      return options;
   }, [id, currentPage, isAuthenticated, isInitialized, shouldFetchChapters]);

   // Fetch chapters for all pages
   const chapterQueries = useQueries({
      queries: chapterQueryOptions,
   });

   // Track last processed data to prevent infinite loops
   const lastProcessedDataRef = useRef<{
      chapterIds: Set<string>;
      accessSignature: string;
      pagination: { hasNextPage: boolean; currentPage: number; totalPages: number } | null;
   }>({ chapterIds: new Set(), accessSignature: '', pagination: null });

   // Clear chapter list when subscription does not allow access
   useEffect(() => {
      if (isAccessRestricted) {
         setAllChapters([]);
         setPagination(null);
         lastProcessedDataRef.current = {
            chapterIds: new Set(),
            accessSignature: '',
            pagination: null,
         };
      }
   }, [isAccessRestricted]);

   // Combine all chapters from all pages and sort by chapterNumber
   useEffect(() => {
      if (!shouldFetchChapters) {
         return;
      }

      const chapters: Chapter[] = [];
      let latestPagination: { hasNextPage: boolean; currentPage: number; totalPages: number } | null = null;

      chapterQueries.forEach((query) => {
         if (query.data?.data) {
            chapters.push(...query.data.data);
            if (query.data.pagination) {
               latestPagination = {
                  hasNextPage: query.data.pagination.hasNextPage,
                  currentPage: query.data.pagination.currentPage,
                  totalPages: query.data.pagination.totalPages,
               };
            }
         }
      });

      // Remove duplicates by id
      const uniqueChapters = chapters.filter(
         (chapter, index, self) =>
            index === self.findIndex((c) => c.id === chapter.id)
      );

      // Sort by chapterNumber
      uniqueChapters.sort((a, b) => a.chapterNumber - b.chapterNumber);

      // Check if data actually changed by comparing chapter IDs
      const currentChapterIds = new Set(uniqueChapters.map((c) => c.id));
      const lastChapterIds = lastProcessedDataRef.current.chapterIds;
      const accessSignature = getChapterListSyncSignature(uniqueChapters);
      const accessChanged =
         accessSignature !== lastProcessedDataRef.current.accessSignature;

      // Check if sets are different
      let paginationChanged = false;
      if (latestPagination !== null) {
         const pag = latestPagination as { hasNextPage: boolean; currentPage: number; totalPages: number };
         const lastPagination = lastProcessedDataRef.current.pagination;
         paginationChanged =
            pag.hasNextPage !== (lastPagination?.hasNextPage ?? false) ||
            pag.currentPage !== (lastPagination?.currentPage ?? 0);
      }

      const hasChanged =
         currentChapterIds.size !== lastChapterIds.size ||
         !Array.from(currentChapterIds).every((id) => lastChapterIds.has(id)) ||
         paginationChanged ||
         accessChanged;

      // Only update state if data actually changed
      if (hasChanged) {
         setAllChapters(uniqueChapters);
         if (latestPagination) {
            setPagination(latestPagination);
            lastProcessedDataRef.current = {
               chapterIds: currentChapterIds,
               accessSignature,
               pagination: latestPagination,
            };
         } else {
            lastProcessedDataRef.current = {
               chapterIds: currentChapterIds,
               accessSignature,
               pagination: null,
            };
         }
      }
   }, [chapterQueries, shouldFetchChapters]);

   // Check loading state
   const isLoadingChapters = chapterQueries.some((query) => query.isLoading);
   const chaptersError = chapterQueries.find((query) => query.error);

   // Get first chapter ID for streaming playlist
   const firstChapterId = useMemo(() => {
      if (allChapters.length > 0) {
         // Sort by chapterNumber to ensure we get the first chapter
         const sortedChapters = [...allChapters].sort((a, b) => a.chapterNumber - b.chapterNumber);
         return sortedChapters[0]?.id || null;
      }
      return null;
   }, [allChapters]);

   const autoPlayChapterId = useMemo(() => {
      if (typeof chapterId === 'string' && chapterId.length > 0) {
         return allChapters.some((chapter) => chapter.id === chapterId) ? chapterId : null;
      }
      return firstChapterId;
   }, [chapterId, allChapters, firstChapterId]);

   // Fetch streaming playlist for first chapter after chapters have loaded
   // This pre-fetches master playlist and playlist data for the first chapter
   useStreamingPlaylist(
      firstChapterId,
      shouldFetchChapters && !!firstChapterId && allChapters.length > 0
   );

   useStreamingPlaylist(
      autoPlayChapterId !== firstChapterId ? autoPlayChapterId : null,
      shouldFetchChapters &&
         autoPlay === 'true' &&
         !!autoPlayChapterId &&
         autoPlayChapterId !== firstChapterId
   );

   // Get playlists from Redux to check if playlist is loaded
   const playlistsByChapterId = useSelector(
      (state: RootState) => state.streaming.playlistsByChapterId
   );

   // Get current playing chapter ID and playing state
   const currentPlayingChapterId = useSelector(
      (state: RootState) => state.player.currentChapterId
   );
   const isPlaying = useSelector(
      (state: RootState) => state.player.isPlaying
   );
   const audiobookId = useSelector(
      (state: RootState) => state.player.audiobookId
   );
   const user = useSelector((state: RootState) => state.auth.user);

   const chapterIds = useMemo(
      () => allChapters.map((chapter) => chapter.id),
      [allChapters]
   );
   useChaptersProgress(
      chapterIds,
      shouldFetchChapters && allChapters.length > 0
   );

   // Track last initialized chapter to prevent duplicate API calls
   const lastInitializedChapterRef = useRef<string | null>(null);

   // Fetch playlist for currently playing chapter if not already loaded
   // This ensures playlist is fetched when user clicks a chapter
   const { data: currentChapterPlaylist } = useStreamingPlaylist(
      currentPlayingChapterId,
      !!currentPlayingChapterId && !playlistsByChapterId[currentPlayingChapterId]
   );

   // Set total duration and auto-play when playlist loads for clicked chapter
   useEffect(() => {
      if (
         currentPlayingChapterId &&
         currentChapterPlaylist &&
         playlistsByChapterId[currentPlayingChapterId]
      ) {
         const playlistData = playlistsByChapterId[currentPlayingChapterId];
         // Calculate total duration from segments
         const totalDuration = playlistData.playlist.segments.reduce(
            (sum: number, segment: { duration: number }) => sum + segment.duration,
            0
         );
         dispatch(setTotalDuration(totalDuration));

         // Auto-play only if this chapter was clicked by the user
         if (clickedChapterIdRef.current === currentPlayingChapterId) {
            dispatch(play());
            // Reset the ref after starting playback
            clickedChapterIdRef.current = null;

            // Initialize playback session when playback starts
            if (
               user?.id &&
               audiobookId &&
               currentPlayingChapterId &&
               lastInitializedChapterRef.current !== currentPlayingChapterId
            ) {
               lastInitializedChapterRef.current = currentPlayingChapterId;
               initializePlaybackSession({
                  userId: user.id,
                  audiobookId,
                  chapterId: currentPlayingChapterId,
               }).catch((error: unknown) => {
                  // Log error but don't block playback
                  console.error('[Details Screen] Failed to initialize playback session:', error);
               });
            }

            // Note: Initial sync on play is handled by usePlaybackSync hook (1 second delay)
            // No need to sync immediately here
         }
      }
   }, [currentPlayingChapterId, currentChapterPlaylist, playlistsByChapterId, dispatch]);

   useEffect(() => {
      if (isInitialized && !isAuthenticated) {
         router.replace('/signin');
      }
   }, [isAuthenticated, isInitialized]);

   // Load next page when user scrolls to bottom
   const loadNextPage = useCallback(() => {
      if (
         shouldFetchChapters &&
         pagination?.hasNextPage &&
         !paginationLoadingRef.current &&
         !isLoadingChapters &&
         currentPage < (pagination.totalPages || 1)
      ) {
         paginationLoadingRef.current = true;
         setCurrentPage((prev) => {
            const nextPage = prev + 1;
            // Reset loading flag after query completes
            setTimeout(() => {
               paginationLoadingRef.current = false;
            }, 1000);
            return nextPage;
         });
      }
   }, [shouldFetchChapters, pagination, isLoadingChapters, currentPage]);

   // Handle back button press
   const handleBack = useCallback(() => {
      router.back();
   }, []);

   const handleUpgradePlanPress = useCallback(() => {
      router.push('/subscription-plans');
   }, []);

   const renderUpgradeSection = useCallback(() => {
      if (!isAccessRestricted) {
         return null;
      }

      return (
         <View style={styles.upgradeSection}>
            <TouchableOpacity
               style={styles.upgradeBadge}
               onPress={handleUpgradePlanPress}
               activeOpacity={0.7}
            >
               <Ionicons name="lock-closed" size={16} color={colors.primary[50]} />
               <Text style={styles.upgradeBadgeText}>Upgrade your plan</Text>
            </TouchableOpacity>
            {upgradeMessage ? (
               <Text style={styles.upgradeMessage}>{upgradeMessage}</Text>
            ) : null}
         </View>
      );
   }, [isAccessRestricted, upgradeMessage, handleUpgradePlanPress, colors.primary, styles]);

   // Handle chapter press
   const handleChapterPress = useCallback(
      async (chapter: Chapter) => {
         if (!canAccessChapter(chapter)) {
            return;
         }

         clickedChapterIdRef.current = chapter.id;

         const playlistData = playlistsByChapterId[chapter.id];
         const totalDurationSeconds = playlistData
            ? playlistData.playlist.segments.reduce(
                 (sum: number, segment: { duration: number }) => sum + segment.duration,
                 0
              )
            : undefined;

         await openChapterForPlayback({
            chapter,
            dispatch,
            totalDurationSeconds,
            totalChapters: allChapters.length,
            autoPlay: !!playlistData,
         });

         requestChapterReload();

         if (
            user?.id &&
            chapter.audiobookId &&
            chapter.id &&
            lastInitializedChapterRef.current !== chapter.id
         ) {
            lastInitializedChapterRef.current = chapter.id;
            initializePlaybackSession({
               userId: user.id,
               audiobookId: chapter.audiobookId,
               chapterId: chapter.id,
            }).catch((error: unknown) => {
               console.error('[Details Screen] Failed to initialize playback session:', error);
            });
         }

         if (!playlistData) {
            console.log(
               '[Details Screen] Playlist not loaded yet, will fetch for chapter:',
               chapter.id
            );
         }
      },
      [dispatch, playlistsByChapterId, user?.id]
   );

   const handlePlayAll = useCallback(() => {
      const sorted = [...allChapters].sort((a, b) => a.chapterNumber - b.chapterNumber);
      const firstAccessible = sorted.find((chapter) => canAccessChapter(chapter));
      if (firstAccessible) {
         void handleChapterPress(firstAccessible);
      }
   }, [allChapters, handleChapterPress]);

   // Track if auto-play has been triggered to prevent multiple triggers
   const autoPlayTriggeredRef = useRef(false);

   // Auto-play target chapter when autoPlay query param is present
   useEffect(() => {
      if (
         autoPlay !== 'true' ||
         isLoadingChapters ||
         allChapters.length === 0 ||
         !autoPlayChapterId ||
         autoPlayTriggeredRef.current
      ) {
         return;
      }

      const targetChapter = allChapters.find((chapter) => chapter.id === autoPlayChapterId);
      const playlistData = playlistsByChapterId[autoPlayChapterId];

      if (targetChapter && playlistData && canAccessChapter(targetChapter)) {
         autoPlayTriggeredRef.current = true;
         handleChapterPress(targetChapter);
      }
   }, [
      autoPlay,
      isLoadingChapters,
      allChapters,
      autoPlayChapterId,
      playlistsByChapterId,
      handleChapterPress,
   ]);

   // Format audiobook duration
   const formattedDuration = useMemo(() => {
      if (!audiobook?.duration) return '';
      return formatDuration(audiobook.duration);
   }, [audiobook?.duration]);

   // Render chapter item
   const renderChapterItem = useCallback(
      ({ item }: { item: Chapter }) => {
         const isActiveChapter = item.id === currentPlayingChapterId;

         return (
            <ChapterListItem
               chapter={item}
               onPress={(chapter) => {
                  void handleChapterPress(chapter);
               }}
               isCurrentlyPlaying={
                  isPlayerVisible &&
                  item.id === currentPlayingChapterId &&
                  isPlaying
               }
               isActive={isActiveChapter}
               onDownloadPress={() => {}}
            />
         );
      },
      [
         handleChapterPress,
         currentPlayingChapterId,
         isPlaying,
         isPlayerVisible,
      ]
   );

   // Render footer with loading indicator
   const renderFooter = useCallback(() => {
      if (!isLoadingChapters || !pagination?.hasNextPage) {
         return null;
      }
      return (
         <View style={styles.footerLoader}>
            <ActivityIndicator size="small" color={colors.app.red} />
         </View>
      );
   }, [isLoadingChapters, pagination]);

   // Render empty state
   const renderEmpty = useCallback(() => {
      if (isAccessRestricted) {
         return (
            <View style={styles.upgradeSectionContainer}>
               {renderUpgradeSection()}
            </View>
         );
      }

      if (isLoadingChapters) {
         return (
            <View style={styles.emptyContainer}>
               <SkeletonChapterRow count={6} />
            </View>
         );
      }

      if (chaptersError) {
         return (
            <View style={styles.emptyContainer}>
               <Text style={styles.errorText}>
                  {chaptersError instanceof Error
                     ? chaptersError.message
                     : 'Failed to load chapters'}
               </Text>
            </View>
         );
      }

      return (
         <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No chapters available</Text>
         </View>
      );
   }, [isAccessRestricted, isLoadingChapters, chaptersError, renderUpgradeSection]);

   const handleDetailTabPress = useCallback((key: string) => {
      setDetailTab(key as 'chapters' | 'about');
   }, []);

   const renderAboutContent = useCallback(() => {
      if (isAudiobookLoading || !audiobook) {
         return <SkeletonDetailsAbout lines={5} />;
      }

      if (!audiobook.description?.trim()) {
         return (
            <View style={styles.aboutSection}>
               <Text style={styles.aboutEmpty}>No description available.</Text>
            </View>
         );
      }

      return (
         <View style={styles.aboutSection}>
            <Text style={styles.aboutDescription}>{audiobook.description}</Text>
         </View>
      );
   }, [audiobook, isAudiobookLoading]);

   // Render book header (above tab slide panels)
   const renderBookHeader = useCallback(() => {
      const smallCoverUri = audiobook
         ? resolveAudiobookImageUrl(audiobook, 'detailsThumb')
         : undefined;
      const chapterCount = allChapters.length;
      const genres = audiobook?.genres ?? [];

      return (
         <>
            {/* Top actions */}
            <View style={styles.topActions}>
               <TouchableOpacity onPress={handleBack} style={styles.topIconButton} activeOpacity={0.7}>
                  <Ionicons
                     name={APP_BACK_ICON}
                     size={APP_BACK_ICON_SIZE}
                     color={colors.text.primary}
                  />
               </TouchableOpacity>
               <View style={styles.topActionsRight}>
                  <TouchableOpacity
                     style={styles.topIconButton}
                     activeOpacity={0.7}
                     onPress={handleFavoritePress}
                     disabled={addFavorite.isPending || removeFavorite.isPending}
                  >
                     <Ionicons
                        name={favorite ? 'heart' : 'heart-outline'}
                        size={22}
                        color={favorite ? colors.like : colors.text.secondary}
                     />
                  </TouchableOpacity>
                  <TouchableOpacity
                     style={styles.topIconButton}
                     activeOpacity={0.7}
                     onPress={() => setPlaylistSheetVisible(true)}
                  >
                     <Ionicons name="ellipsis-horizontal" size={22} color={colors.text.primary} />
                  </TouchableOpacity>
               </View>
            </View>

            {isAudiobookLoading || !audiobook ? (
               <SkeletonDetailsHeader showGenreChips />
            ) : (
               <>
                  <View style={styles.bookRow}>
                     {smallCoverUri ? (
                        <Image source={{ uri: smallCoverUri }} style={styles.bookCover} contentFit="cover" />
                     ) : null}
                     <View style={styles.bookInfo}>
                        <Text style={styles.audiobookTitle} numberOfLines={2}>
                           {audiobook.title}
                        </Text>
                        {audiobook.author ? (
                           <Text style={styles.bookAuthor}>{audiobook.author}</Text>
                        ) : null}
                        <StarRating
                           rating={aggregateRating}
                           interactive={canRate}
                           onRate={handleRate}
                        />
                        <Text style={styles.bookMeta}>
                           {formattedDuration}
                           {chapterCount > 0 ? ` · ${chapterCount} chapters` : ''}
                        </Text>
                     </View>
                  </View>

                  {!isAccessRestricted && (
                     <View style={styles.actionButtons}>
                        <PrimaryButton
                           title="Play"
                           icon="play"
                           onPress={handlePlayAll}
                           style={styles.playBtn}
                        />
                        <SecondaryButton
                           title="Download"
                           icon="download-outline"
                           onPress={() => {}}
                           style={styles.downloadBtn}
                        />
                     </View>
                  )}

                  {genres.length > 0 && (
                     <View style={styles.genresContainer}>
                        {genres.map((genre, index) => (
                           <View key={`${genre.name}-${index}`} style={styles.genreChip}>
                              <Text style={styles.genreChipText}>{genre.name}</Text>
                           </View>
                        ))}
                     </View>
                  )}
               </>
            )}

            <TabUnderline
               tabs={[
                  { key: 'chapters', label: 'Chapters' },
                  { key: 'about', label: 'About' },
               ]}
               activeKey={detailTab}
               onTabPress={handleDetailTabPress}
            />
         </>
      );
   }, [
      isAudiobookLoading,
      audiobook,
      allChapters,
      formattedDuration,
      detailTab,
      handleBack,
      handlePlayAll,
      handleDetailTabPress,
      isAccessRestricted,
      handleFavoritePress,
      favorite,
      addFavorite.isPending,
      removeFavorite.isPending,
      aggregateRating,
      canRate,
      handleRate,
   ]);

   const handleDetailsRefresh = useCallback(async () => {
      setCurrentPage(1);
      setAllChapters([]);
      setPagination(null);
      lastProcessedDataRef.current = {
         chapterIds: new Set(),
         accessSignature: '',
         pagination: null,
      };

      const refetches: Promise<unknown>[] = [refetchAudiobook(), refetchFavorite()];
      if (id) {
         refetches.push(
            queryClient.refetchQueries({
               queryKey: queryKeys.audiobooks.chapters(id, 1),
            })
         );
      }
      await Promise.all(refetches);
   }, [refetchAudiobook, refetchFavorite, id, queryClient]);

   const detailsRefreshFns = useMemo(
      () => [handleDetailsRefresh],
      [handleDetailsRefresh]
   );
   const { refreshing, onRefresh } = usePullToRefresh(detailsRefreshFns, {
      isRefetching:
         isAudiobookRefetching ||
         isFavoriteRefetching ||
         chapterQueries.some((query) => query.isRefetching),
   });

   const detailsRefreshControl = (
      <RefreshControl
         refreshing={refreshing}
         onRefresh={onRefresh}
         tintColor={colors.accent.primary}
         colors={[colors.accent.primary]}
      />
   );

   return (
      <>
         {id ? (
            <AddToPlaylistSheet
               visible={playlistSheetVisible}
               audiobookId={id}
               onClose={() => setPlaylistSheetVisible(false)}
            />
         ) : null}
         <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.bookHeaderWrapper}>{renderBookHeader()}</View>
            <TabSlideView
               activeKey={detailTab}
               tabKeys={['chapters', 'about']}
               onTabChange={handleDetailTabPress}
               style={styles.tabSlideContainer}
            >
               <FlatList
                  style={isAccessRestricted ? styles.restrictedTabList : undefined}
                  data={isAccessRestricted ? [] : allChapters}
                  renderItem={renderChapterItem}
                  keyExtractor={(item) => item.id}
                  ListEmptyComponent={renderEmpty}
                  ListFooterComponent={renderFooter}
                  onEndReached={loadNextPage}
                  onEndReachedThreshold={0.5}
                  removeClippedSubviews={true}
                  showsVerticalScrollIndicator={false}
                  refreshControl={detailsRefreshControl}
                  contentContainerStyle={[
                     styles.scrollContent,
                     scrollContentStyle,
                     isAccessRestricted && styles.scrollContentRestricted,
                  ]}
               />
               <ScrollView
                  showsVerticalScrollIndicator={false}
                  refreshControl={detailsRefreshControl}
                  contentContainerStyle={[styles.scrollContent, scrollContentStyle]}
               >
                  {renderAboutContent()}
               </ScrollView>
            </TabSlideView>
         </SafeAreaView>
      </>
   );
}

