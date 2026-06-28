/**
 * Blocks mutating API calls for guest users and signs them out locally.
 */

import { ApiError } from '@/services/api';
import { isGuestUser } from '@/utils/guestUser';
import { showToast } from '@/utils/toast';

export const GUEST_SIGN_IN_REQUIRED_MESSAGE =
   'Please sign in first to continue.';

export const GUEST_MUTATION_FORBIDDEN_CODE = 'GUEST_MUTATION_FORBIDDEN';

const MUTATING_HTTP_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const GUEST_MUTATION_ALLOWED_ENDPOINTS = ['/auth/guest', '/auth/logout'];

const GUEST_LOCATION_PROFILE_ENDPOINT = '/auth/user/profile';

function parseRequestBody(body: unknown): Record<string, unknown> | null {
   if (body == null) {
      return null;
   }

   if (typeof body === 'string') {
      if (body.trim() === '') {
         return null;
      }

      try {
         const parsed: unknown = JSON.parse(body);
         return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null;
      } catch {
         return null;
      }
   }

   if (typeof body === 'object' && !Array.isArray(body)) {
      return body as Record<string, unknown>;
   }

   return null;
}

export function isGuestAllowedLocationUpdate(
   method: string | undefined,
   endpoint: string,
   body?: unknown
): boolean {
   if ((method ?? 'GET').toUpperCase() !== 'PUT') {
      return false;
   }

   if (endpoint !== GUEST_LOCATION_PROFILE_ENDPOINT) {
      return false;
   }

   const payload = parseRequestBody(body);
   if (!payload) {
      return false;
   }

   const keys = Object.keys(payload);
   return keys.length === 1 && keys[0] === 'location';
}

function isGuestMutationAllowedRequest(
   method: string | undefined,
   endpoint: string,
   body?: unknown
): boolean {
   return (
      isGuestMutationAllowedEndpoint(endpoint) ||
      isGuestAllowedLocationUpdate(method, endpoint, body)
   );
}

let isHandlingGuestMutation = false;

export function isMutatingHttpMethod(method?: string): boolean {
   if (!method) {
      return false;
   }

   return MUTATING_HTTP_METHODS.has(method.toUpperCase());
}

function isGuestMutationAllowedEndpoint(endpoint: string): boolean {
   return GUEST_MUTATION_ALLOWED_ENDPOINTS.some(
      (allowed) => endpoint === allowed || endpoint.startsWith(`${allowed}?`)
   );
}

export function createGuestMutationForbiddenError(): ApiError {
   return new ApiError(403, 'Forbidden', {
      message: GUEST_SIGN_IN_REQUIRED_MESSAGE,
      code: GUEST_MUTATION_FORBIDDEN_CODE,
   });
}

async function clearGuestSessionAndRedirect(): Promise<void> {
   // eslint-disable-next-line @typescript-eslint/no-require-imports
   const { store } = require('@/store');
   // eslint-disable-next-line @typescript-eslint/no-require-imports
   const { clearAuth } = require('@/store/auth');
   // eslint-disable-next-line @typescript-eslint/no-require-imports
   const { clearAudiobooks } = require('@/store/audiobooks');
   // eslint-disable-next-line @typescript-eslint/no-require-imports
   const { releasePlayback } = require('@/store/player');
   // eslint-disable-next-line @typescript-eslint/no-require-imports
   const { teardownTrackPlayerPlayback } = require('@/services/playbackTeardown');
   // eslint-disable-next-line @typescript-eslint/no-require-imports
   const { clearDeviceLocationCache } = require('@/services/location');
   // eslint-disable-next-line @typescript-eslint/no-require-imports
   const { queryClient } = require('@/utils/queryClient');
   // eslint-disable-next-line @typescript-eslint/no-require-imports
   const { router } = require('expo-router');

   store.dispatch(releasePlayback());
   clearDeviceLocationCache();
   await teardownTrackPlayerPlayback();
   queryClient.clear();
   store.dispatch(clearAuth());
   store.dispatch(clearAudiobooks());
   router.replace('/signin');
}

export async function handleGuestMutationBlocked(): Promise<void> {
   if (isHandlingGuestMutation) {
      return;
   }

   isHandlingGuestMutation = true;

   try {
      showToast({
         message: GUEST_SIGN_IN_REQUIRED_MESSAGE,
         type: 'error',
      });
      await clearGuestSessionAndRedirect();
   } catch (error) {
      console.error('[Guest Mutation Guard] Failed to clear guest session:', error);
   } finally {
      setTimeout(() => {
         isHandlingGuestMutation = false;
      }, 1000);
   }
}

/**
 * Returns true when the request was blocked for a guest user.
 */
export async function checkAndBlockGuestMutation(
   method: string | undefined,
   endpoint: string,
   body?: unknown
): Promise<boolean> {
   if (!isMutatingHttpMethod(method) || isGuestMutationAllowedRequest(method, endpoint, body)) {
      return false;
   }

   // eslint-disable-next-line @typescript-eslint/no-require-imports
   const { store } = require('@/store');
   const state = store.getState();

   if (!isGuestUser(state.auth?.user)) {
      return false;
   }

   await handleGuestMutationBlocked();
   return true;
}
