import { queryClient } from '@/utils/queryClient';
import { queryKeys } from '@/constants/queryKeys';
import {
   getDeletedResourceIds,
   markResourceDeleted,
} from '@/utils/deletedResourceRegistry';
import type {
   ApplyDomainCacheEventContext,
   CacheInvalidateEvent,
} from '@/types/domainCacheEvents';

const AUDIOBOOK_LIST_ROOTS = new Set(['tag', 'genre', 'mood', 'search']);

function queryKeyStartsWith(
   key: readonly unknown[],
   prefix: readonly unknown[]
): boolean {
   if (key.length < prefix.length) {
      return false;
   }
   return prefix.every((segment, index) => key[index] === segment);
}

function keysEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
   return a.length === b.length && a.every((segment, index) => segment === b[index]);
}

function shouldSkipInvalidation(
   key: readonly unknown[],
   removalPrefixes: readonly (readonly unknown[])[],
   deletedAudiobookIds: readonly string[]
): boolean {
   if (removalPrefixes.some((prefix) => queryKeyStartsWith(key, prefix))) {
      return true;
   }

   if (
      key.length === 2 &&
      key[0] === 'audiobooks' &&
      typeof key[1] === 'string' &&
      deletedAudiobookIds.includes(key[1])
   ) {
      return true;
   }

   if (
      key.length >= 2 &&
      typeof key[1] === 'string' &&
      deletedAudiobookIds.includes(key[1]) &&
      key[0] === 'audiobooks'
   ) {
      return true;
   }

   return false;
}

function uniqueQueryKeys(keys: readonly (readonly unknown[])[]): readonly (readonly unknown[])[] {
   const seen = new Set<string>();
   const result: (readonly unknown[])[] = [];

   for (const key of keys) {
      const serialized = JSON.stringify(key);
      if (seen.has(serialized)) {
         continue;
      }
      seen.add(serialized);
      result.push(key);
   }

   return result;
}

function isAudiobookListQueryKey(key: readonly unknown[]): boolean {
   if (key[0] !== 'audiobooks') {
      return false;
   }
   if (key.length === 1) {
      return true;
   }
   if (key.length === 2 && typeof key[1] === 'number') {
      return true;
   }
   if (key.length >= 2 && AUDIOBOOK_LIST_ROOTS.has(String(key[1]))) {
      return true;
   }
   return false;
}

function isFavoriteAudiobookDetailKey(
   key: readonly unknown[],
   deletedAudiobookIds: readonly string[]
): boolean {
   return (
      key.length === 4 &&
      key[0] === 'favorites' &&
      key[1] === 'me' &&
      key[2] === 'audiobook' &&
      typeof key[3] === 'string' &&
      deletedAudiobookIds.includes(key[3])
   );
}

function isContinueListeningKeyForDeletedAudiobook(
   key: readonly unknown[],
   deletedAudiobookIds: readonly string[]
): boolean {
   if (key[0] !== 'playback' || key[1] !== 'continue-listening') {
      return false;
   }
   const audiobookId = key[key.length - 1];
   return typeof audiobookId === 'string' && deletedAudiobookIds.includes(audiobookId);
}

function invalidateQueryKeySafely(
   key: readonly unknown[],
   deletedAudiobookIds: readonly string[]
): void {
   if (keysEqual(key, queryKeys.audiobooks.all())) {
      void queryClient.invalidateQueries({
         predicate: (query) => isAudiobookListQueryKey(query.queryKey),
      });
      return;
   }

   if (keysEqual(key, queryKeys.favorites.all())) {
      void queryClient.invalidateQueries({
         predicate: (query) => {
            const queryKey = query.queryKey;
            if (queryKey[0] !== 'favorites') {
               return false;
            }
            return !isFavoriteAudiobookDetailKey(queryKey, deletedAudiobookIds);
         },
      });
      return;
   }

   if (key.length === 1) {
      void queryClient.invalidateQueries({ queryKey: [...key], exact: true });
      return;
   }

   void queryClient.invalidateQueries({ queryKey: [...key] });
}

function markDeletedResource(event: CacheInvalidateEvent): void {
   const { resource, id, relatedIds = {} } = event;

   switch (resource) {
      case 'audiobook':
         markResourceDeleted('audiobooks', id);
         break;
      case 'chapter':
         markResourceDeleted('chapters', id);
         break;
      case 'playlist':
         markResourceDeleted('playlists', id);
         break;
      case 'organization':
         markResourceDeleted('organizations', id);
         break;
      case 'mood':
         markResourceDeleted('moods', id);
         break;
      case 'genre':
         markResourceDeleted('genres', id);
         break;
      case 'tag':
         markResourceDeleted('tags', id);
         break;
      case 'user-device':
         markResourceDeleted('devices', id);
         break;
      case 'subscription-plan':
         markResourceDeleted('subscription-plans', id);
         break;
      case 'organization-member':
         if (relatedIds.organizationId) {
            markResourceDeleted('organizations', relatedIds.organizationId);
         }
         break;
      default:
         markResourceDeleted(resource, id);
         break;
   }
}

function getDeletedRemovalPrefixes(
   event: CacheInvalidateEvent
): readonly (readonly unknown[])[] {
   const { resource, id, relatedIds = {} } = event;

   switch (resource) {
      case 'audiobook':
         return [
            queryKeys.audiobooks.detail(id),
            queryKeys.favorites.byAudiobook(id),
            queryKeys.playback.continueListening(id),
            queryKeys.playback.continueListeningDiscover(id),
         ];
      case 'chapter': {
         const audiobookId = relatedIds.audiobookId ?? id;
         return [
            queryKeys.audiobooks.chapter(audiobookId, id),
            queryKeys.playback.chapterProgress(id),
            queryKeys.bookmarks.byChapter(id),
            ['streaming', 'playlist', id],
         ];
      }
      case 'comment':
      case 'review':
      case 'note':
      case 'bookmark':
      case 'favorite':
         return [[resource, id]];
      case 'playlist':
         return [queryKeys.playlists.detail(id), queryKeys.playlists.items(id)];
      case 'playlist-item': {
         const playlistId = relatedIds.playlistId ?? id;
         return [queryKeys.playlists.items(playlistId)];
      }
      case 'organization':
         return [queryKeys.organizations.detail(id)];
      case 'organization-member': {
         const organizationId = relatedIds.organizationId ?? id;
         return [['organizations', organizationId, 'members']];
      }
      case 'mood':
         return [queryKeys.moods.detail(id)];
      case 'genre':
         return [queryKeys.genres.detail(id)];
      case 'tag':
         return [queryKeys.tags.detail(id)];
      case 'user-device':
         return [['devices', id]];
      case 'subscription-plan':
         return [queryKeys.subscriptionPlans.all(), ['subscription-plans', id]];
      case 'user-subscription':
         return [queryKeys.subscriptions.me(), ['subscriptions', id]];
      case 'user-profile':
         return [['user-profile'], ['user-profile', 'me']];
      case 'author':
         return [['authors', id], ['authors', 'me']];
      case 'author-profile':
         return [['author-profiles', id], ['author-profiles', 'me']];
      case 'user-audiobook':
         return [queryKeys.userAudiobooks.me()];
      case 'offline-download':
         return [['offline-downloads', id], ['offline-downloads', 'me']];
      default:
         return [[resource, id]];
   }
}

function getDeletedCascadeInvalidations(
   event: CacheInvalidateEvent
): readonly (readonly unknown[])[] {
   const { resource, relatedIds = {} } = event;

   switch (resource) {
      case 'audiobook':
         return [
            queryKeys.favorites.all(),
            queryKeys.favorites.me(),
            queryKeys.bookmarks.all(),
            queryKeys.bookmarks.me(),
            queryKeys.playlists.all(),
            queryKeys.playlists.me(),
            queryKeys.userAudiobooks.all(),
            queryKeys.userAudiobooks.me(),
         ];
      case 'chapter': {
         const audiobookId = relatedIds.audiobookId;
         if (!audiobookId) {
            return [];
         }
         return [
            queryKeys.audiobooks.chaptersAll(audiobookId),
            queryKeys.audiobooks.detail(audiobookId),
         ];
      }
      case 'playlist':
         return [queryKeys.playlists.all(), queryKeys.playlists.me()];
      case 'playlist-item': {
         const playlistId = relatedIds.playlistId ?? event.id;
         return [
            queryKeys.playlists.detail(playlistId),
            queryKeys.playlists.all(),
            queryKeys.playlists.me(),
         ];
      }
      case 'comment':
      case 'review': {
         const audiobookId = relatedIds.audiobookId;
         if (!audiobookId) {
            return [];
         }
         return [
            queryKeys.audiobooks.commentsAll(audiobookId),
            queryKeys.audiobooks.detail(audiobookId),
         ];
      }
      case 'note':
      case 'bookmark': {
         const audiobookId = relatedIds.audiobookId;
         const keys: (readonly unknown[])[] = [];
         if (audiobookId) {
            keys.push(queryKeys.audiobooks.notes(audiobookId));
            keys.push(queryKeys.audiobooks.detail(audiobookId));
         }
         if (resource === 'bookmark') {
            keys.push(queryKeys.bookmarks.all(), queryKeys.bookmarks.me());
         }
         return keys;
      }
      case 'favorite':
         return [queryKeys.favorites.all(), queryKeys.favorites.me()];
      case 'organization-member': {
         const organizationId = relatedIds.organizationId ?? event.id;
         return [
            queryKeys.organizations.detail(organizationId),
            queryKeys.organizations.all(),
         ];
      }
      default:
         return [];
   }
}

function removeDeletedQueries(prefixes: readonly (readonly unknown[])[]): void {
   for (const prefix of prefixes) {
      void queryClient.cancelQueries({ queryKey: [...prefix], exact: false });
      void queryClient.removeQueries({ queryKey: [...prefix], exact: false });
   }
}

function removeThenInvalidatePrefixes(prefixes: readonly (readonly unknown[])[]): void {
   for (const prefix of uniqueQueryKeys(prefixes)) {
      void queryClient.cancelQueries({ queryKey: [...prefix], exact: false });
      void queryClient.removeQueries({ queryKey: [...prefix], exact: false });
      void queryClient.invalidateQueries({ queryKey: [...prefix], exact: false });
   }
}

function resolveSubscriptionPrefixes(
   event: CacheInvalidateEvent
): readonly (readonly unknown[])[] {
   return uniqueQueryKeys(event.queryKeys);
}

function shouldApplySubscriptionCatalogEvent(
   event: CacheInvalidateEvent,
   context: ApplyDomainCacheEventContext
): boolean {
   const eventUserId = event.relatedIds?.userId;
   const currentUserId = context.currentUserId;
   if (eventUserId && currentUserId && eventUserId !== currentUserId) {
      return false;
   }
   return true;
}

function applySubscriptionCatalogEvent(
   event: CacheInvalidateEvent,
   context: ApplyDomainCacheEventContext
): void {
   if (!shouldApplySubscriptionCatalogEvent(event, context)) {
      return;
   }
   removeThenInvalidatePrefixes(resolveSubscriptionPrefixes(event));
}

function applySubscriptionGatingEvent(event: CacheInvalidateEvent): void {
   const audiobookId = event.relatedIds?.audiobookId;

   if (audiobookId) {
      removeThenInvalidatePrefixes([
         queryKeys.audiobooks.detail(audiobookId),
         queryKeys.audiobooks.chaptersAll(audiobookId),
         queryKeys.audiobooks.all(),
      ]);
      return;
   }

   const prefixes: (readonly unknown[])[] = [
      ...event.queryKeys,
      queryKeys.audiobooks.all(),
      queryKeys.userAudiobooks.all(),
   ];

   if (event.relatedIds?.planId) {
      prefixes.push(
         queryKeys.subscriptionPlans.all(),
         ['subscription-plans', event.relatedIds.planId]
      );
   }

   removeThenInvalidatePrefixes(uniqueQueryKeys(prefixes));
}

function cancelDeletedEntityQueries(deletedAudiobookIds: readonly string[]): void {
   for (const audiobookId of deletedAudiobookIds) {
      void queryClient.cancelQueries({
         queryKey: queryKeys.audiobooks.detail(audiobookId),
         exact: false,
      });
   }

   void queryClient.cancelQueries({
      predicate: (query) => {
         const queryKey = query.queryKey;
         return (
            isFavoriteAudiobookDetailKey(queryKey, deletedAudiobookIds) ||
            isContinueListeningKeyForDeletedAudiobook(queryKey, deletedAudiobookIds)
         );
      },
   });
}

function applyDeletedDomainCacheEvent(event: CacheInvalidateEvent): void {
   markDeletedResource(event);

   const removalPrefixes = getDeletedRemovalPrefixes(event);
   const deletedAudiobookIds =
      event.resource === 'audiobook'
         ? Array.from(new Set([...getDeletedResourceIds('audiobooks'), event.id]))
         : getDeletedResourceIds('audiobooks');

   removeDeletedQueries(removalPrefixes);
   cancelDeletedEntityQueries(deletedAudiobookIds);

   const invalidationKeys = uniqueQueryKeys([
      ...event.queryKeys,
      ...getDeletedCascadeInvalidations(event),
   ]).filter(
      (key) => !shouldSkipInvalidation(key, removalPrefixes, deletedAudiobookIds)
   );

   for (const queryKey of invalidationKeys) {
      invalidateQueryKeySafely(queryKey, deletedAudiobookIds);
   }
}

/**
 * Applies a backend cache-invalidate SSE event to the TanStack Query cache.
 * Delete events remove entity caches (avoid 404 refetch loops) and refresh lists.
 */
export function applyDomainCacheEvent(
   event: CacheInvalidateEvent,
   context: ApplyDomainCacheEventContext = {}
): void {
   if (event.action === 'deleted') {
      applyDeletedDomainCacheEvent(event);
      return;
   }

   if (event.resource === 'subscription-catalog') {
      applySubscriptionCatalogEvent(event, context);
      return;
   }

   if (event.resource === 'subscription-gating') {
      applySubscriptionGatingEvent(event);
      return;
   }

   const deletedAudiobookIds = getDeletedResourceIds('audiobooks');
   for (const queryKey of event.queryKeys) {
      if (shouldSkipInvalidation(queryKey, [], deletedAudiobookIds)) {
         continue;
      }
      invalidateQueryKeySafely(queryKey, deletedAudiobookIds);
   }
}
