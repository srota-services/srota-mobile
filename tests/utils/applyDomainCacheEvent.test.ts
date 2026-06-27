import { applyDomainCacheEvent } from '@/utils/applyDomainCacheEvent';
import {
   clearDeletedResources,
   isResourceDeleted,
} from '@/utils/deletedResourceRegistry';
import { queryClient } from '@/utils/queryClient';
import { queryKeys } from '@/constants/queryKeys';

jest.mock('@/utils/queryClient', () => ({
   queryClient: {
      cancelQueries: jest.fn(),
      removeQueries: jest.fn(),
      invalidateQueries: jest.fn(),
   },
}));

describe('applyDomainCacheEvent', () => {
   beforeEach(() => {
      jest.clearAllMocks();
      clearDeletedResources();
   });

   it('invalidates query keys for create/update events', () => {
      applyDomainCacheEvent({
         version: 1,
         service: 'app',
         resource: 'audiobook',
         action: 'updated',
         id: 'ab-1',
         queryKeys: [['audiobooks'], ['audiobooks', 'ab-1']],
         timestamp: '2026-06-13T00:00:00.000Z',
      });

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
         predicate: expect.any(Function),
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
         queryKey: ['audiobooks', 'ab-1'],
      });
      expect(queryClient.removeQueries).not.toHaveBeenCalled();
   });

   it('removes deleted audiobook caches and refreshes list queries only', () => {
      applyDomainCacheEvent({
         version: 1,
         service: 'app',
         resource: 'audiobook',
         action: 'deleted',
         id: 'ab-1',
         queryKeys: [['audiobooks'], ['audiobooks', 'ab-1']],
         timestamp: '2026-06-13T00:00:00.000Z',
      });

      expect(isResourceDeleted('audiobooks', 'ab-1')).toBe(true);
      expect(queryClient.cancelQueries).toHaveBeenCalledWith({
         queryKey: ['audiobooks', 'ab-1'],
         exact: false,
      });
      expect(queryClient.removeQueries).toHaveBeenCalledWith({
         queryKey: ['audiobooks', 'ab-1'],
         exact: false,
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
         predicate: expect.any(Function),
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
         queryKey: queryKeys.favorites.me(),
      });
      expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({
         queryKey: ['audiobooks', 'ab-1'],
      });
   });

   it('removes deleted chapter caches and refreshes chapter lists', () => {
      applyDomainCacheEvent({
         version: 1,
         service: 'app',
         resource: 'chapter',
         action: 'deleted',
         id: 'ch-1',
         relatedIds: { audiobookId: 'ab-1' },
         queryKeys: [
            ['audiobooks', 'ab-1', 'chapters'],
            ['audiobooks', 'ab-1'],
            ['audiobooks'],
         ],
         timestamp: '2026-06-13T00:00:00.000Z',
      });

      expect(isResourceDeleted('chapters', 'ch-1')).toBe(true);
      expect(queryClient.removeQueries).toHaveBeenCalledWith({
         queryKey: ['audiobooks', 'ab-1', 'chapters', 'ch-1'],
         exact: false,
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
         queryKey: ['audiobooks', 'ab-1', 'chapters'],
      });
      expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({
         queryKey: ['audiobooks', 'ab-1', 'chapters', 'ch-1'],
      });
   });

   it('subscription-catalog removes and invalidates when userId matches', () => {
      applyDomainCacheEvent(
         {
            version: 1,
            service: 'auth',
            resource: 'subscription-catalog',
            action: 'updated',
            id: 'sub-1',
            relatedIds: { userId: 'user-1', planId: 'plan-1' },
            queryKeys: [
               ['subscriptions'],
               ['subscriptions', 'me'],
               ['audiobooks'],
               ['user-audiobooks'],
               ['user-audiobooks', 'me'],
            ],
            timestamp: '2026-06-13T00:00:00.000Z',
         },
         { currentUserId: 'user-1' }
      );

      expect(queryClient.removeQueries).toHaveBeenCalledWith({
         queryKey: ['audiobooks'],
         exact: false,
      });
      expect(queryClient.removeQueries).toHaveBeenCalledWith({
         queryKey: ['user-audiobooks'],
         exact: false,
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
         queryKey: ['audiobooks'],
         exact: false,
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
         queryKey: ['subscriptions', 'me'],
         exact: false,
      });
   });

   it('subscription-catalog no-ops when userId does not match', () => {
      applyDomainCacheEvent(
         {
            version: 1,
            service: 'auth',
            resource: 'subscription-catalog',
            action: 'updated',
            id: 'sub-1',
            relatedIds: { userId: 'other-user', planId: 'plan-1' },
            queryKeys: [['audiobooks'], ['user-audiobooks']],
            timestamp: '2026-06-13T00:00:00.000Z',
         },
         { currentUserId: 'user-1' }
      );

      expect(queryClient.removeQueries).not.toHaveBeenCalled();
      expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
   });

   it('subscription-gating removes and invalidates scoped audiobook and chapters', () => {
      applyDomainCacheEvent({
         version: 1,
         service: 'app',
         resource: 'subscription-gating',
         action: 'updated',
         id: 'ab-1',
         relatedIds: { audiobookId: 'ab-1' },
         queryKeys: [
            ['audiobooks'],
            ['audiobooks', 'ab-1'],
            ['audiobooks', 'ab-1', 'chapters'],
         ],
         timestamp: '2026-06-13T00:00:00.000Z',
      });

      expect(queryClient.removeQueries).toHaveBeenCalledWith({
         queryKey: ['audiobooks', 'ab-1'],
         exact: false,
      });
      expect(queryClient.removeQueries).toHaveBeenCalledWith({
         queryKey: ['audiobooks', 'ab-1', 'chapters'],
         exact: false,
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
         queryKey: ['audiobooks'],
         exact: false,
      });
   });

   it('subscription-gating removes and invalidates full catalog on plan change', () => {
      applyDomainCacheEvent({
         version: 1,
         service: 'auth',
         resource: 'subscription-gating',
         action: 'updated',
         id: 'plan-1',
         relatedIds: { planId: 'plan-1' },
         queryKeys: [
            ['subscription-plans'],
            ['subscription-plans', 'plan-1'],
            ['audiobooks'],
            ['user-audiobooks'],
            ['user-audiobooks', 'me'],
         ],
         timestamp: '2026-06-13T00:00:00.000Z',
      });

      expect(queryClient.removeQueries).toHaveBeenCalledWith({
         queryKey: ['audiobooks'],
         exact: false,
      });
      expect(queryClient.removeQueries).toHaveBeenCalledWith({
         queryKey: ['subscription-plans'],
         exact: false,
      });
      expect(queryClient.removeQueries).toHaveBeenCalledWith({
         queryKey: ['user-audiobooks'],
         exact: false,
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
         queryKey: ['subscription-plans', 'plan-1'],
         exact: false,
      });
   });
});
