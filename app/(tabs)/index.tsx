import React, { useMemo, useCallback, useRef, useState } from 'react';
import {
   View,
   StyleSheet,
   ScrollView,
   Text,
   TouchableOpacity,
   Platform,
   RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { AnimatedTabScreen } from '@/components/AnimatedTabScreen';
import { ContinueListeningCard } from '@/components/ContinueListeningCard';
import { MoodChip } from '@/components/MoodChip';
import { useMoods } from '@/hooks/useMoods';
import { ContentRow, ContentItem } from '@/components/ContentRow';
import { DrawerMenu } from '@/components/DrawerMenu';
import { spacing, typography, borderRadius } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { getTabScreenPaddingBottom } from '@/theme/tabLayout';
import { useHomeContent } from '@/hooks/useHomeContent';
import { useTimeOfDay } from '@/hooks/useTimeOfDay';
import { useContinueListening } from '@/hooks/useContinueListening';
import { useOrganizations } from '@/hooks/useOrganizations';
import { PublisherRow } from '@/components/PublisherRow';
import {
   SkeletonContentRow,
   SkeletonContinueListeningCard,
   SkeletonMoodCards,
   SkeletonTrendingList,
} from '@/components/skeleton';
import { Organization, getOrganizationImagePath, getOrganizationImageUri } from '@/services/organizations';
import { logout } from '@/utils/logout';
import { RootState } from '@/store';
import { resolveAvatarUrl } from '@/utils/resolveAvatarUrl';
import { resolveAudiobookImageUrl } from '@/utils/imageAssets';
import { resolveMembershipTier } from '@/utils/membershipDisplay';
import { useUserSubscription } from '@/hooks/useUserSubscription';
import { useTabScrollToTop } from '@/hooks/useTabScrollToTop';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { playContinueListeningChapter } from '@/utils/playContinueListeningChapter';
import { getHomeGreetingName } from '@/utils/guestUser';

const HEADER_ICON_SIZE = 24;
const HEADER_ICON_HIT_SLOP = spacing.xs;
const HEADER_ICON_BUTTON_SIZE = HEADER_ICON_SIZE + HEADER_ICON_HIT_SLOP * 2;
const TOP_BAR_HEIGHT = HEADER_ICON_BUTTON_SIZE + spacing.sm * 2;

function HomeScreenContent() {
   const { colors } = useTheme();
   const styles = useThemedStyles((t) =>
      StyleSheet.create({
         container: {
            flex: 1,
            backgroundColor: t.colors.background.screen,
         },
         scrollView: {
            flex: 1,
         },
         scrollContent: {
            paddingTop: spacing.xs,
         },
         topBar: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: TOP_BAR_HEIGHT,
            paddingHorizontal: spacing.md,
         },
         iconButton: {
            width: HEADER_ICON_BUTTON_SIZE,
            height: HEADER_ICON_BUTTON_SIZE,
            alignItems: 'center',
            justifyContent: 'center',
         },
         greetingSection: {
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.md,
         },
         greeting: {
            fontSize: typography.fontSize['2xl'],
            fontWeight: '700',
            color: t.colors.text.primary,
            ...Platform.select({
               ios: { fontFamily: 'System', fontWeight: '700' },
               android: { fontFamily: 'sans-serif-medium' },
            }),
         },
         greetingSubtitle: {
            fontSize: typography.fontSize.base,
            color: t.colors.text.secondary,
            marginTop: spacing.xs,
         },
         searchBar: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: t.colors.background.input,
            borderRadius: borderRadius.lg,
            marginHorizontal: spacing.md,
            marginBottom: spacing.lg,
            paddingHorizontal: spacing.md,
            height: 48,
            gap: spacing.sm,
         },
         searchPlaceholder: {
            fontSize: typography.fontSize.base,
            color: t.colors.text.muted,
            flex: 1,
         },
         section: {
            marginBottom: spacing.lg,
         },
         sectionHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: spacing.md,
            marginBottom: spacing.sm,
         },
         sectionTitle: {
            fontSize: typography.fontSize.lg,
            fontWeight: '600',
            color: t.colors.text.primary,
            paddingHorizontal: spacing.md,
            marginBottom: spacing.sm,
            ...Platform.select({
               ios: { fontFamily: 'System', fontWeight: '600' },
               android: { fontFamily: 'sans-serif-medium' },
            }),
         },
         sectionTitlePadded: {
            marginBottom: spacing.sm,
         },
         viewAll: {
            fontSize: typography.fontSize.sm,
            color: t.colors.accent.primary,
            fontWeight: '500',
         },
         moodRow: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
         },
         trendingSection: {
            marginBottom: 0,
         },
         trendingList: {
            paddingHorizontal: spacing.md,
         },
         trendingCard: {
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 112,
            padding: spacing.md,
            marginBottom: spacing.sm,
            borderRadius: borderRadius.xl,
            backgroundColor: t.colors.background.card,
            ...t.shadows.sm,
         },
         trendingCardLast: {
            marginBottom: 0,
         },
         trendingCardCover: {
            width: 72,
            height: 96,
            borderRadius: borderRadius.lg,
            marginRight: spacing.md,
         },
         trendingCardBody: {
            flex: 1,
            justifyContent: 'center',
            paddingVertical: spacing.xs,
            marginRight: spacing.sm,
         },
         trendingCoverPlaceholder: {
            backgroundColor: t.colors.background.highlight,
            alignItems: 'center',
            justifyContent: 'center',
         },
         trendingCoverLetter: {
            fontSize: typography.fontSize.lg,
            fontWeight: '700',
            color: t.colors.accent.primary,
         },
         trendingTitle: {
            fontSize: typography.fontSize.lg,
            fontWeight: '600',
            color: t.colors.text.primary,
            lineHeight: typography.fontSize.lg * 1.3,
         },
         trendingAuthor: {
            fontSize: typography.fontSize.sm,
            color: t.colors.text.secondary,
            marginTop: spacing.xs,
         },
         trendingPlay: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: t.colors.primary[50],
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'center',
         },
         loadingContainer: {
            padding: spacing.xl,
            alignItems: 'center',
         },
         loadingText: {
            marginTop: spacing.md,
            color: t.colors.text.secondary,
         },
         errorContainer: {
            padding: spacing.xl,
            alignItems: 'center',
         },
         errorText: {
            color: t.colors.error,
            textAlign: 'center',
         },
      })
   );
   const paginationTriggeredRef = useRef<Record<string, boolean>>({});
   const scrollRef = useRef<ScrollView>(null);
   const insets = useSafeAreaInsets();
   const [drawerVisible, setDrawerVisible] = useState(false);
   const { greeting, subtitle: timeOfDaySubtitle } = useTimeOfDay();

   const userProfile = useSelector((state: RootState) => state.auth.userProfile);
   const user = useSelector((state: RootState) => state.auth.user);
   const { activeSubscription, refetch: refetchSubscription, isRefetching: isSubscriptionRefetching } =
      useUserSubscription();
   const dispatch = useDispatch();
   const {
      data: continueListening,
      isLoading: isContinueListeningLoading,
      refetch: refetchContinueListening,
   } = useContinueListening();

   const greetingName = useMemo(
      () => getHomeGreetingName(user, userProfile?.firstName),
      [user, userProfile?.firstName]
   );

   const drawerDisplayName = useMemo(() => {
      if (userProfile?.firstName && userProfile?.lastName) {
         return `${userProfile.firstName} ${userProfile.lastName}`;
      }
      if (userProfile?.firstName) return userProfile.firstName;
      if (userProfile?.username) return userProfile.username;
      return 'User';
   }, [userProfile]);
   const drawerAvatarUri = resolveAvatarUrl(
      userProfile?.avatar,
      userProfile?.imageAssets
   );
   const membershipTier = resolveMembershipTier(activeSubscription?.plan);
   const planName = activeSubscription?.plan.name;

   const handleDrawerNavigate = useCallback((href: string) => {
      router.push(href as never);
   }, []);

   const handleDrawerSignOut = useCallback(async () => {
      try {
         await logout();
      } catch (error) {
         console.error('[Home] Logout failed:', error);
      }
   }, []);

   const {
      contentRows,
      isLoading,
      loadNextPage,
      heroCarouselItems,
      refetchAll,
      isRefetching: isHomeContentRefetching,
   } = useHomeContent();
   const {
      data: moods,
      isLoading: moodsLoading,
      refetch: refetchMoods,
      isRefetching: isMoodsRefetching,
   } = useMoods();
   const {
      data: organizationsData,
      isLoading: organizationsLoading,
      isPending: organizationsPending,
      refetch: refetchOrganizations,
      isRefetching: isOrganizationsRefetching,
   } = useOrganizations();
   const organizations = organizationsData?.organizations ?? [];

   const getOrganizationImageUriForCard = useCallback(
      (org: Organization) => getOrganizationImageUri(org),
      []
   );

   const handlePublisherPress = useCallback((org: Organization) => {
      const imagePath = getOrganizationImagePath(org);
      router.push({
         pathname: '/publisher/[id]',
         params: {
            id: org.id,
            name: org.name,
            ...(org.description ? { description: org.description } : {}),
            ...(imagePath ? { imagePath } : {}),
         },
      } as never);
   }, []);


   const yourPicksRow = useMemo(() => {
      return contentRows.find((row) => row.items.length > 0) ?? null;
   }, [contentRows]);

   const trendingItems = useMemo(() => {
      const trendingRow = contentRows.find((row) =>
         row.title.toLowerCase().includes('trending')
      );
      const booksById = new Map(heroCarouselItems.map((book) => [book.id, book]));

      const mapBook = (id: string, title: string, imageUri?: string) => {
         const book = booksById.get(id);
         return {
            id,
            title,
            author: book?.author ?? 'Unknown author',
            imageUri:
               imageUri ??
               (book ? resolveAudiobookImageUrl(book, 'popularStory') : undefined),
         };
      };

      if (trendingRow?.items.length) {
         return trendingRow.items.map((item) =>
            mapBook(item.id, item.title, item.imageUri)
         );
      }

      return heroCarouselItems.map((book) =>
         mapBook(
            book.id,
            book.title,
            resolveAudiobookImageUrl(book, 'popularStory')
         )
      );
   }, [contentRows, heroCarouselItems]);

   const scrollPadding = getTabScreenPaddingBottom(insets.bottom);

   const handleItemPress = useCallback((item: ContentItem) => {
      router.push(`/details/${item.id}`);
   }, []);

   const handleEndReached = useCallback(
      (rowId: string) => {
         const row = contentRows.find((r) => r.id === rowId);
         if (
            row?.pagination?.hasNextPage &&
            !paginationTriggeredRef.current[rowId] &&
            !row.isLoading
         ) {
            paginationTriggeredRef.current[rowId] = true;
            loadNextPage(rowId);
            setTimeout(() => {
               paginationTriggeredRef.current[rowId] = false;
            }, 1000);
         }
      },
      [contentRows, loadNextPage]
   );

   const handleContinueListening = useCallback(async () => {
      if (!continueListening) {
         return;
      }

      const started = await playContinueListeningChapter(
         continueListening.id,
         continueListening.chapterId,
         dispatch
      );

      if (!started) {
         router.push(
            `/details/${continueListening.id}?chapterId=${continueListening.chapterId}&autoPlay=true` as never
         );
      }
   }, [continueListening, dispatch]);

   const showContinueListeningSkeleton =
      !continueListening && isContinueListeningLoading;

   const showPublishersSkeleton =
      organizationsPending ||
      organizationsLoading ||
      (organizations.length === 0 && isLoading);

   const showYourPicksSkeleton = isLoading && !(yourPicksRow?.items.length);

   const showTrendingSkeleton = isLoading && trendingItems.length === 0;

   useTabScrollToTop('index', scrollRef);

   const homeRefreshFns = useMemo(
      () => [
         refetchAll,
         refetchMoods,
         refetchOrganizations,
         refetchSubscription,
         refetchContinueListening,
      ],
      [
         refetchAll,
         refetchMoods,
         refetchOrganizations,
         refetchSubscription,
         refetchContinueListening,
      ]
   );
   const { refreshing, onRefresh } = usePullToRefresh(homeRefreshFns, {
      isRefetching:
         isHomeContentRefetching ||
         isMoodsRefetching ||
         isOrganizationsRefetching ||
         isSubscriptionRefetching,
   });

   return (
      <SafeAreaView style={styles.container} edges={['top']}>
         <View style={styles.topBar}>
            <TouchableOpacity
               onPress={() => setDrawerVisible(true)}
               style={styles.iconButton}
               activeOpacity={0.7}
               accessibilityLabel="Open menu"
               accessibilityRole="button"
            >
               <Ionicons name="grid-outline" size={HEADER_ICON_SIZE} color={colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity
               onPress={() => {}}
               style={styles.iconButton}
               activeOpacity={0.7}
               accessibilityLabel="Notifications"
               accessibilityRole="button"
            >
               <Ionicons
                  name="notifications-outline"
                  size={HEADER_ICON_SIZE}
                  color={colors.text.primary}
               />
            </TouchableOpacity>
         </View>

         <ScrollView
            ref={scrollRef}
            style={styles.scrollView}
            contentContainerStyle={[
               styles.scrollContent,
               { paddingBottom: scrollPadding },
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
               <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.accent.primary}
                  colors={[colors.accent.primary]}
               />
            }
         >
            {/* Greeting */}
            <View style={styles.greetingSection}>
               <Text style={styles.greeting}>
                  {greeting}, {greetingName}
               </Text>
               <Text style={styles.greetingSubtitle}>{timeOfDaySubtitle}</Text>
            </View>

            {/* Search */}
            <TouchableOpacity
               style={styles.searchBar}
               onPress={() => router.push('/search')}
               activeOpacity={0.8}
            >
               <Ionicons name="search" size={20} color={colors.text.muted} />
               <Text style={styles.searchPlaceholder}>Search stories, authors, genres...</Text>
            </TouchableOpacity>

            <PublisherRow
               organizations={organizations}
               isLoading={showPublishersSkeleton}
               getImageUri={getOrganizationImageUriForCard}
               onPress={handlePublisherPress}
            />

            {/* Continue Listening */}
            {(continueListening || showContinueListeningSkeleton) && (
               <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Continue Listening</Text>
                  {continueListening ? (
                     <ContinueListeningCard
                        title={continueListening.title}
                        author={continueListening.author}
                        coverUri={continueListening.coverUri}
                        chapterTitle={continueListening.chapterTitle}
                        chapterNumber={continueListening.chapterNumber}
                        progress={continueListening.progress}
                        elapsedSeconds={continueListening.elapsedSeconds}
                        totalSeconds={continueListening.totalSeconds}
                        onPress={() => {
                           void handleContinueListening();
                        }}
                        onPlayPress={() => {
                           void handleContinueListening();
                        }}
                     />
                  ) : (
                     <SkeletonContinueListeningCard />
                  )}
               </View>
            )}

            {/* Your Picks */}
            {(yourPicksRow?.items.length || showYourPicksSkeleton) ? (
               <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                     <Text style={styles.sectionTitle}>Your Picks</Text>
                     {yourPicksRow?.items.length ? (
                        <TouchableOpacity activeOpacity={0.7}>
                           <Text style={styles.viewAll}>View all</Text>
                        </TouchableOpacity>
                     ) : null}
                  </View>
                  {yourPicksRow?.items.length ? (
                     <ContentRow
                        title=""
                        items={yourPicksRow.items}
                        onItemPress={handleItemPress}
                        onEndReached={() => handleEndReached(yourPicksRow.id)}
                     />
                  ) : (
                     <SkeletonContentRow hideTitle cardWidth={140} cardCount={4} />
                  )}
               </View>
            ) : null}

            {/* Explore By Mood */}
            <View style={styles.section}>
               <Text style={[styles.sectionTitle, styles.sectionTitlePadded]}>
                  Explore By Mood
               </Text>
               <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.moodRow}
               >
                  {moodsLoading ? (
                     <SkeletonMoodCards />
                  ) : (
                     (moods ?? []).map((mood) => (
                        <MoodChip
                           key={mood.id}
                           mood={mood}
                           variant="card"
                           onPress={() => router.push(`/moods/${mood.id}` as never)}
                        />
                     ))
                  )}
               </ScrollView>
            </View>

            {/* New and Trending */}
            <View style={styles.trendingSection}>
               <Text style={[styles.sectionTitle, styles.sectionTitlePadded]}>
                  New and Trending
               </Text>
               <View style={styles.trendingList}>
                  {showTrendingSkeleton ? (
                     <SkeletonTrendingList count={3} />
                  ) : (
                     trendingItems.map((item, index) => (
                     <TouchableOpacity
                        key={item.id}
                        style={[
                           styles.trendingCard,
                           index === trendingItems.length - 1 && styles.trendingCardLast,
                        ]}
                        onPress={() => router.push(`/details/${item.id}`)}
                        activeOpacity={0.85}
                     >
                        {item.imageUri ? (
                           <Image
                              source={{ uri: item.imageUri }}
                              style={styles.trendingCardCover}
                              contentFit="cover"
                           />
                        ) : (
                           <View
                              style={[
                                 styles.trendingCardCover,
                                 styles.trendingCoverPlaceholder,
                              ]}
                           >
                              <Text style={styles.trendingCoverLetter}>
                                 {item.title.charAt(0)}
                              </Text>
                           </View>
                        )}
                        <View style={styles.trendingCardBody}>
                           <Text style={styles.trendingTitle} numberOfLines={2}>
                              {item.title}
                           </Text>
                           <Text style={styles.trendingAuthor} numberOfLines={1}>
                              {item.author}
                           </Text>
                        </View>
                        <TouchableOpacity
                           style={styles.trendingPlay}
                           onPress={() =>
                              router.push(`/details/${item.id}?autoPlay=true`)
                           }
                           activeOpacity={0.8}
                        >
                           <Ionicons name="play" size={18} color={colors.accent.primary} />
                        </TouchableOpacity>
                     </TouchableOpacity>
                  ))
                  )}
               </View>
            </View>
         </ScrollView>

         <DrawerMenu
            visible={drawerVisible}
            onClose={() => setDrawerVisible(false)}
            currentRoute="index"
            displayName={drawerDisplayName}
            avatarUri={drawerAvatarUri}
            membershipTier={membershipTier}
            planName={planName}
            onNavigate={handleDrawerNavigate}
            onSignOut={handleDrawerSignOut}
         />
      </SafeAreaView>
   );
}

export default function HomeScreen() {
   return (
      <AnimatedTabScreen direction="left" currentRoute="index">
         <HomeScreenContent />
      </AnimatedTabScreen>
   );
}
