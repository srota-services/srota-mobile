/**
 * Subscribes to auth/app SSE cache-invalidation streams and syncs TanStack Query cache.
 */

import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import {
   connectDomainEventStream,
   DomainEventStreamAuthError,
} from '@/services/domainEventsStream';
import { applyDomainCacheEvent } from '@/utils/applyDomainCacheEvent';
import { clearDeletedResources } from '@/utils/deletedResourceRegistry';
import type { CacheInvalidateEvent, DomainEventStreamKind } from '@/types/domainCacheEvents';

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const INVALIDATION_BATCH_MS = 50;

export function useDomainEventsSync(): void {
   const accessToken = useSelector((state: RootState) => state.auth.accessToken);
   const isAuthenticated = useSelector(
      (state: RootState) => state.auth.isAuthenticated
   );
   const isInitialized = useSelector(
      (state: RootState) => state.auth.isInitialized
   );
   const currentUserId = useSelector((state: RootState) => state.auth.user?.id ?? null);

   const pendingEventsRef = useRef<CacheInvalidateEvent[]>([]);
   const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   const abortControllersRef = useRef<AbortController[]>([]);
   const backoffRef = useRef(INITIAL_BACKOFF_MS);
   const shouldConnectRef = useRef(false);
   const accessTokenRef = useRef<string | null>(null);
   const currentUserIdRef = useRef<string | null>(null);

   const flushInvalidations = (): void => {
      batchTimerRef.current = null;
      const events = pendingEventsRef.current;
      pendingEventsRef.current = [];
      for (const event of events) {
         applyDomainCacheEvent(event, {
            currentUserId: currentUserIdRef.current,
         });
      }
   };

   const queueInvalidation = (event: CacheInvalidateEvent): void => {
      pendingEventsRef.current.push(event);
      if (!batchTimerRef.current) {
         batchTimerRef.current = setTimeout(flushInvalidations, INVALIDATION_BATCH_MS);
      }
   };

   const disconnect = (): void => {
      if (reconnectTimerRef.current) {
         clearTimeout(reconnectTimerRef.current);
         reconnectTimerRef.current = null;
      }
      for (const controller of abortControllersRef.current) {
         controller.abort();
      }
      abortControllersRef.current = [];
   };

   const scheduleReconnect = (): void => {
      if (!shouldConnectRef.current || reconnectTimerRef.current) {
         return;
      }
      const delay = backoffRef.current;
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
      reconnectTimerRef.current = setTimeout(() => {
         reconnectTimerRef.current = null;
         void connectStreams();
      }, delay);
   };

   const connectStream = async (
      kind: DomainEventStreamKind,
      token: string,
      signal: AbortSignal
   ): Promise<void> => {
      await connectDomainEventStream({
         kind,
         accessToken: token,
         signal,
         onInvalidate: queueInvalidation,
      });
   };

   const connectStreams = async (): Promise<void> => {
      const token = accessTokenRef.current;
      if (!shouldConnectRef.current || !token) {
         return;
      }

      disconnect();

      const authController = new AbortController();
      const appController = new AbortController();
      abortControllersRef.current = [authController, appController];

      const runStream = async (
         kind: DomainEventStreamKind,
         controller: AbortController
      ): Promise<void> => {
         try {
            await connectStream(kind, token, controller.signal);
         } catch (error) {
            if (controller.signal.aborted) {
               return;
            }
            if (error instanceof DomainEventStreamAuthError) {
               shouldConnectRef.current = false;
               disconnect();
               return;
            }
            scheduleReconnect();
         }
      };

      backoffRef.current = INITIAL_BACKOFF_MS;
      await Promise.all([
         runStream('auth', authController),
         runStream('app', appController),
      ]);
   };

   useEffect(() => {
      accessTokenRef.current = accessToken;
   }, [accessToken]);

   useEffect(() => {
      currentUserIdRef.current = currentUserId;
   }, [currentUserId]);

   useEffect(() => {
      const shouldConnect =
         isAuthenticated && isInitialized && Boolean(accessToken);

      shouldConnectRef.current = shouldConnect;

      if (!shouldConnect) {
         disconnect();
         if (batchTimerRef.current) {
            clearTimeout(batchTimerRef.current);
            batchTimerRef.current = null;
         }
         pendingEventsRef.current = [];
         clearDeletedResources();
         return;
      }

      void connectStreams();

      return () => {
         shouldConnectRef.current = false;
         disconnect();
         if (batchTimerRef.current) {
            clearTimeout(batchTimerRef.current);
            batchTimerRef.current = null;
         }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [isAuthenticated, isInitialized, accessToken]);

   useEffect(() => {
      const handleAppState = (nextState: AppStateStatus): void => {
         if (
            nextState === 'active' &&
            shouldConnectRef.current &&
            abortControllersRef.current.length === 0
         ) {
            void connectStreams();
         }
      };

      const subscription = AppState.addEventListener('change', handleAppState);
      return () => subscription.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);
}
