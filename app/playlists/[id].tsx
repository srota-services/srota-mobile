import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
   View,
   Text,
   StyleSheet,
   FlatList,
   TouchableOpacity,
   ActivityIndicator,
   TextInput,
   Alert,
   Platform,
   KeyboardAvoidingView,
   ScrollView,
   BackHandler,
   RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { usePlaylistItems, usePlaylists, usePlaylistMutations } from '@/hooks/usePlaylists';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useNotFoundRedirect } from '@/hooks/useNotFoundRedirect';
import { usePlaylistAudiobooks } from '@/hooks/usePlaylistAudiobooks';
import { useAudiobookSearch } from '@/hooks/useAudiobookSearch';
import { APP_BACK_ICON, APP_BACK_ICON_SIZE } from '@/constants/navigationIcons';
import { Audiobook } from '@/services/audiobooks';
import {
   AudiobookGridCard,
   GRID_PADDING,
   GRID_GAP,
   NUM_COLUMNS,
} from '@/components/AudiobookGridCard';
import { HomeStyleSearchBar } from '@/components/HomeStyleSearchBar';
import { spacing, typography, borderRadius } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import {
   SkeletonGrid,
   SkeletonPlaylistHeader,
   SkeletonPlaylistSearchGrid,
} from '@/components/skeleton';

const SEARCH_DEBOUNCE_MS = 350;

export default function PlaylistDetailScreen() {
   const { colors } = useTheme();
   const styles = useThemedStyles((t) =>
      StyleSheet.create({
         container: {
            flex: 1,
            backgroundColor: t.colors.background.screen,
         },
         flex: {
            flex: 1,
         },
         header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
         },
         headerSpacer: {
            flex: 1,
         },
         editHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
         },
         editHeaderDivider: {
            height: 1,
            backgroundColor: t.colors.background.highlight,
         },
         editHeaderSide: {
            minWidth: 72,
         },
         editHeaderTitle: {
            fontSize: typography.fontSize.lg,
            fontWeight: '600',
            color: t.colors.text.primary,
            ...Platform.select({
               android: { fontFamily: 'sans-serif-medium' },
            }),
         },
         cancelText: {
            fontSize: typography.fontSize.base,
            color: t.colors.text.secondary,
         },
         saveHeaderText: {
            fontSize: typography.fontSize.base,
            fontWeight: '600',
            color: t.colors.accent.primary,
            textAlign: 'right',
         },
         saveHeaderTextDisabled: {
            color: t.colors.text.muted,
         },
         editScroll: {
            padding: spacing.md,
            paddingBottom: spacing.xxl,
         },
         fieldLabel: {
            fontSize: typography.fontSize.sm,
            fontWeight: '600',
            color: t.colors.text.secondary,
            marginBottom: spacing.xs,
            marginTop: spacing.md,
         },
         titleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.xs,
            gap: spacing.xs,
            maxWidth: '100%',
         },
         playlistName: {
            flexShrink: 1,
            fontSize: typography.fontSize['2xl'],
            fontWeight: '700',
            color: t.colors.text.primary,
            ...Platform.select({
               android: { fontFamily: 'sans-serif-medium' },
            }),
         },
         pencilBtn: {
            padding: spacing.xs,
         },
         playlistDesc: {
            fontSize: typography.fontSize.sm,
            color: t.colors.text.secondary,
            paddingHorizontal: spacing.md,
            marginBottom: spacing.sm,
         },
         input: {
            borderRadius: borderRadius.md,
            padding: spacing.md,
            fontSize: typography.fontSize.base,
            color: t.colors.text.primary,
            backgroundColor: t.colors.background.input,
         },
         textArea: {
            minHeight: 120,
            textAlignVertical: 'top',
         },
         searchSection: {
            paddingBottom: spacing.md,
         },
         searchSectionTitle: {
            fontSize: typography.fontSize.sm,
            fontWeight: '600',
            color: t.colors.text.secondary,
            paddingHorizontal: spacing.md,
            marginBottom: spacing.sm,
         },
         searchLoader: {
            marginVertical: spacing.md,
         },
         searchEmpty: {
            paddingHorizontal: spacing.md,
            color: t.colors.text.muted,
            fontSize: typography.fontSize.sm,
         },
         searchGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            paddingHorizontal: GRID_PADDING,
            gap: GRID_GAP,
         },
         sectionLabel: {
            fontSize: typography.fontSize.lg,
            fontWeight: '600',
            color: t.colors.text.primary,
            paddingHorizontal: spacing.md,
            marginBottom: spacing.sm,
         },
         loader: {
            marginTop: spacing.xl,
         },
         listContent: {
            paddingHorizontal: GRID_PADDING,
            paddingBottom: spacing.xxl,
         },
         gridRow: {
            gap: GRID_GAP,
            marginBottom: GRID_GAP,
         },
         empty: {
            textAlign: 'center',
            color: t.colors.text.secondary,
            padding: spacing.xl,
         },
      })
   );
   const { id } = useLocalSearchParams<{ id: string }>();
   const playlistId = id ?? '';

   const { data: playlistsData, refetch: refetchPlaylists, isRefetching: isPlaylistsRefetching } =
      usePlaylists();
   const playlist = useMemo(
      () => playlistsData?.data?.find((p) => p.id === playlistId),
      [playlistsData, playlistId]
   );

   const {
      data: itemsData,
      isLoading: itemsLoading,
      isNotFound,
      refetch: refetchPlaylistItems,
      isRefetching: isItemsRefetching,
   } = usePlaylistItems(playlistId);
   useNotFoundRedirect(isNotFound, 'This playlist is no longer available.');
   const { update, remove, addItem, removeItem } = usePlaylistMutations();

   const [editing, setEditing] = useState(false);
   const [editName, setEditName] = useState(playlist?.name ?? '');
   const [editDescription, setEditDescription] = useState(playlist?.description ?? '');
   const [searchQuery, setSearchQuery] = useState('');
   const [debouncedSearch, setDebouncedSearch] = useState('');

   useEffect(() => {
      const timer = setTimeout(() => setDebouncedSearch(searchQuery), SEARCH_DEBOUNCE_MS);
      return () => clearTimeout(timer);
   }, [searchQuery]);

   useEffect(() => {
      if (playlist && !editing) {
         setEditName(playlist.name);
         setEditDescription(playlist.description ?? '');
      }
   }, [playlist?.name, playlist?.description, playlist, editing]);

   const cancelEdit = useCallback(() => {
      if (playlist) {
         setEditName(playlist.name);
         setEditDescription(playlist.description ?? '');
      }
      setEditing(false);
   }, [playlist]);

   useFocusEffect(
      useCallback(() => {
         const onHardwareBack = () => {
            if (editing) {
               cancelEdit();
               return true;
            }
            return false;
         };
         const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
         return () => sub.remove();
      }, [editing, cancelEdit])
   );

   const items = useMemo(() => {
      const list = [...(itemsData?.data ?? [])];
      return list.sort((a, b) => a.position - b.position);
   }, [itemsData]);

   const playlistAudiobookIds = useMemo(
      () => new Set(items.map((i) => i.audiobookId)),
      [items]
   );

   const { books: playlistBooks, isLoading: booksLoading } = usePlaylistAudiobooks(items);
   const isLoading = itemsLoading || booksLoading;

   const playlistRefreshFns = useMemo(
      () => [refetchPlaylistItems, refetchPlaylists],
      [refetchPlaylistItems, refetchPlaylists]
   );
   const { refreshing, onRefresh } = usePullToRefresh(playlistRefreshFns, {
      isRefetching: isItemsRefetching || isPlaylistsRefetching,
   });

   const { data: searchData, isFetching: isSearching } = useAudiobookSearch(debouncedSearch);
   const searchResults = useMemo(() => searchData?.data ?? [], [searchData?.data]);

   const hasEditChanges = useMemo(() => {
      if (!playlist) return false;
      const nameChanged = editName.trim() !== playlist.name;
      const descChanged =
         editDescription.trim() !== (playlist.description ?? '').trim();
      return nameChanged || descChanged;
   }, [playlist, editName, editDescription]);

   const handleSaveEdit = useCallback(() => {
      if (!playlistId || !editName.trim()) return;
      update.mutate(
         {
            playlistId,
            name: editName.trim(),
            description: editDescription.trim(),
         },
         { onSuccess: () => setEditing(false) }
      );
   }, [playlistId, editName, editDescription, update]);

   const handleCancelEdit = useCallback(() => {
      if (hasEditChanges) {
         Alert.alert(
            'Discard changes?',
            'Your edits will be lost.',
            [
               { text: 'Keep editing', style: 'cancel' },
               { text: 'Discard', style: 'destructive', onPress: cancelEdit },
            ]
         );
         return;
      }
      cancelEdit();
   }, [hasEditChanges, cancelEdit]);

   const handleHeaderBack = useCallback(() => {
      if (editing) {
         handleCancelEdit();
      } else {
         router.back();
      }
   }, [editing, handleCancelEdit]);

   const handleDeletePlaylist = useCallback(() => {
      Alert.alert('Delete playlist', 'This cannot be undone.', [
         { text: 'Cancel', style: 'cancel' },
         {
            text: 'Delete',
            style: 'destructive',
            onPress: () =>
               remove.mutate(playlistId, {
                  onSuccess: () => router.back(),
               }),
         },
      ]);
   }, [playlistId, remove]);

   const handleAddAudiobook = useCallback(
      (book: Audiobook) => {
         if (playlistAudiobookIds.has(book.id) || addItem.isPending) return;
         addItem.mutate({
            playlistId,
            audiobookId: book.id,
            position: items.length + 1,
         });
      },
      [playlistAudiobookIds, addItem, playlistId, items.length]
   );

   const handleRemoveItem = useCallback(
      (audiobookId: string) => {
         const item = items.find((i) => i.audiobookId === audiobookId);
         if (!item) return;
         removeItem.mutate({ playlistId, itemId: item.id });
      },
      [items, playlistId, removeItem]
   );

   const renderPlaylistBook = useCallback(
      ({ item }: { item: Audiobook }) => (
         <AudiobookGridCard
            item={item}
            onPress={() => router.push(`/details/${item.id}` as never)}
            onRemove={() => handleRemoveItem(item.id)}
         />
      ),
      [handleRemoveItem]
   );

   const listHeader = useMemo(
      () => (
         <View>
            <View style={styles.titleRow}>
               <Text style={styles.playlistName} numberOfLines={2}>
                  {playlist?.name ?? 'Playlist'}
               </Text>
               <TouchableOpacity
                  onPress={() => setEditing(true)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.pencilBtn}
               >
                  <Ionicons name="pencil" size={20} color={colors.accent.primary} />
               </TouchableOpacity>
            </View>
            {playlist?.description ? (
               <Text style={styles.playlistDesc}>{playlist.description}</Text>
            ) : null}

            <HomeStyleSearchBar value={searchQuery} onChangeText={setSearchQuery} />

            {debouncedSearch.trim().length >= 2 && (
               <View style={styles.searchSection}>
                  <Text style={styles.searchSectionTitle}>Search results</Text>
                  {isSearching ? (
                     <SkeletonPlaylistSearchGrid rows={2} />
                  ) : searchResults.length === 0 ? (
                     <Text style={styles.searchEmpty}>No audiobooks found</Text>
                  ) : (
                     <View style={styles.searchGrid}>
                        {searchResults.map((book) => {
                           const alreadyAdded = playlistAudiobookIds.has(book.id);
                           return (
                              <AudiobookGridCard
                                 key={book.id}
                                 item={book}
                                 footerText={
                                    alreadyAdded ? 'Already in playlist' : 'Tap to add'
                                 }
                                 onPress={() => handleAddAudiobook(book)}
                              />
                           );
                        })}
                     </View>
                  )}
               </View>
            )}

            <Text style={styles.sectionLabel}>In this playlist</Text>
         </View>
      ),
      [
         playlist,
         searchQuery,
         debouncedSearch,
         isSearching,
         searchResults,
         playlistAudiobookIds,
         handleAddAudiobook,
         styles,
         colors,
      ]
   );

   if (editing) {
      return (
         <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.editHeader}>
               <TouchableOpacity
                  onPress={handleCancelEdit}
                  style={styles.editHeaderSide}
                  activeOpacity={0.7}
               >
                  <Text style={styles.cancelText}>Cancel</Text>
               </TouchableOpacity>
               <Text style={styles.editHeaderTitle}>Edit playlist</Text>
               <TouchableOpacity
                  onPress={handleSaveEdit}
                  style={styles.editHeaderSide}
                  disabled={!editName.trim() || update.isPending}
                  activeOpacity={0.7}
               >
                  {update.isPending ? (
                     <ActivityIndicator size="small" color={colors.accent.primary} />
                  ) : (
                     <Text
                        style={[
                           styles.saveHeaderText,
                           !editName.trim() && styles.saveHeaderTextDisabled,
                        ]}
                     >
                        Save
                     </Text>
                  )}
               </TouchableOpacity>
            </View>
            <View style={styles.editHeaderDivider} />

            <KeyboardAvoidingView
               style={styles.flex}
               behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
               <ScrollView
                  contentContainerStyle={styles.editScroll}
                  keyboardShouldPersistTaps="handled"
               >
                  <Text style={styles.fieldLabel}>Name</Text>
                  <TextInput
                     style={styles.input}
                     value={editName}
                     onChangeText={setEditName}
                     placeholder="Playlist name"
                     placeholderTextColor={colors.text.muted}
                     autoFocus
                     maxLength={120}
                  />
                  <Text style={styles.fieldLabel}>Description</Text>
                  <TextInput
                     style={[styles.input, styles.textArea]}
                     value={editDescription}
                     onChangeText={setEditDescription}
                     placeholder="Add a description (optional)"
                     placeholderTextColor={colors.text.muted}
                     multiline
                     maxLength={500}
                  />
               </ScrollView>
            </KeyboardAvoidingView>
         </SafeAreaView>
      );
   }

   return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
         <View style={styles.header}>
            <TouchableOpacity onPress={handleHeaderBack} activeOpacity={0.7}>
               <Ionicons
                  name={APP_BACK_ICON}
                  size={APP_BACK_ICON_SIZE}
                  color={colors.text.primary}
               />
            </TouchableOpacity>
            <View style={styles.headerSpacer} />
            <TouchableOpacity onPress={handleDeletePlaylist} activeOpacity={0.7}>
               <Ionicons name="trash-outline" size={22} color={colors.error} />
            </TouchableOpacity>
         </View>

         {isLoading && playlistBooks.length === 0 ? (
            <>
               <SkeletonPlaylistHeader />
               <SkeletonGrid rows={4} />
            </>
         ) : (
            <FlatList
               data={playlistBooks}
               keyExtractor={(item) => item.id}
               renderItem={renderPlaylistBook}
               numColumns={NUM_COLUMNS}
               columnWrapperStyle={styles.gridRow}
               ListHeaderComponent={listHeader}
               ListEmptyComponent={
                  <Text style={styles.empty}>No audiobooks in this playlist yet.</Text>
               }
               refreshControl={
                  <RefreshControl
                     refreshing={refreshing}
                     onRefresh={onRefresh}
                     tintColor={colors.accent.primary}
                     colors={[colors.accent.primary]}
                  />
               }
               contentContainerStyle={styles.listContent}
            />
         )}
      </SafeAreaView>
   );
}
