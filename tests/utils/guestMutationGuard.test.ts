import {
   checkAndBlockGuestMutation,
   createGuestMutationForbiddenError,
   GUEST_MUTATION_FORBIDDEN_CODE,
   GUEST_SIGN_IN_REQUIRED_MESSAGE,
   isGuestAllowedLocationUpdate,
   isMutatingHttpMethod,
} from '@/utils/guestMutationGuard';
import { showToast } from '@/utils/toast';

const mockReplace = jest.fn();
const mockReleasePlayback = jest.fn(() => ({ type: 'player/releasePlayback' }));
const mockClearAuth = jest.fn(() => ({ type: 'auth/clearAuth' }));
const mockClearAudiobooks = jest.fn(() => ({ type: 'audiobooks/clearAudiobooks' }));
const mockClearDeviceLocationCache = jest.fn();
const mockTeardownTrackPlayerPlayback = jest.fn(() => Promise.resolve());
const mockQueryClientClear = jest.fn();

jest.mock('@/utils/toast', () => ({
   showToast: jest.fn(),
}));

jest.mock('expo-router', () => ({
   router: {
      replace: (...args: unknown[]) => mockReplace(...args),
   },
}));

jest.mock('@/store', () => ({
   store: {
      dispatch: jest.fn(),
      getState: jest.fn(),
   },
}));

jest.mock('@/store/auth', () => ({
   clearAuth: () => mockClearAuth(),
}));

jest.mock('@/store/audiobooks', () => ({
   clearAudiobooks: () => mockClearAudiobooks(),
}));

jest.mock('@/store/player', () => ({
   releasePlayback: () => mockReleasePlayback(),
}));

jest.mock('@/services/playbackTeardown', () => ({
   teardownTrackPlayerPlayback: () => mockTeardownTrackPlayerPlayback(),
}));

jest.mock('@/services/location', () => ({
   clearDeviceLocationCache: () => mockClearDeviceLocationCache(),
}));

jest.mock('@/utils/queryClient', () => ({
   queryClient: {
      clear: () => mockQueryClientClear(),
   },
}));

const { store } = jest.requireMock('@/store') as {
   store: {
      dispatch: jest.Mock;
      getState: jest.Mock;
   };
};

const mockedShowToast = showToast as jest.MockedFunction<typeof showToast>;

describe('guestMutationGuard', () => {
   beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers();
      store.getState.mockReturnValue({
         auth: {
            user: {
               id: 'guest-user-1',
               email: 'guest@example.com',
               role: 'GUEST',
               emailVerified: true,
            },
         },
      });
   });

   afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
   });

   describe('isMutatingHttpMethod', () => {
      it('returns true for POST, PUT, PATCH, and DELETE', () => {
         expect(isMutatingHttpMethod('POST')).toBe(true);
         expect(isMutatingHttpMethod('put')).toBe(true);
         expect(isMutatingHttpMethod('PATCH')).toBe(true);
         expect(isMutatingHttpMethod('DELETE')).toBe(true);
      });

      it('returns false for GET and undefined', () => {
         expect(isMutatingHttpMethod('GET')).toBe(false);
         expect(isMutatingHttpMethod(undefined)).toBe(false);
      });
   });

   describe('createGuestMutationForbiddenError', () => {
      it('creates a 403 ApiError with guest mutation metadata', () => {
         const error = createGuestMutationForbiddenError();

         expect(error.status).toBe(403);
         expect(error.data).toEqual({
            message: GUEST_SIGN_IN_REQUIRED_MESSAGE,
            code: GUEST_MUTATION_FORBIDDEN_CODE,
         });
      });
   });

   describe('isGuestAllowedLocationUpdate', () => {
      const locationBody = JSON.stringify({
         location: { latitude: '1', longitude: '2' },
      });

      it('returns true for location-only PUT /auth/user/profile', () => {
         expect(
            isGuestAllowedLocationUpdate('PUT', '/auth/user/profile', locationBody)
         ).toBe(true);
      });

      it('returns false for profile PUT with other fields', () => {
         expect(
            isGuestAllowedLocationUpdate('PUT', '/auth/user/profile', {
               firstName: 'Alex',
            })
         ).toBe(false);
         expect(
            isGuestAllowedLocationUpdate('PUT', '/auth/user/profile', {
               location: { latitude: '1', longitude: '2' },
               firstName: 'Alex',
            })
         ).toBe(false);
      });

      it('returns false for app profile endpoint', () => {
         expect(
            isGuestAllowedLocationUpdate(
               'PUT',
               '/api/v1/user/profile',
               locationBody
            )
         ).toBe(false);
      });
   });

   describe('checkAndBlockGuestMutation', () => {
      it('does not block GET requests for guest users', async () => {
         const blocked = await checkAndBlockGuestMutation('GET', '/api/v1/favorites');

         expect(blocked).toBe(false);
         expect(mockedShowToast).not.toHaveBeenCalled();
         expect(mockReplace).not.toHaveBeenCalled();
      });

      it('does not block POST /auth/guest', async () => {
         const blocked = await checkAndBlockGuestMutation('POST', '/auth/guest');

         expect(blocked).toBe(false);
         expect(mockedShowToast).not.toHaveBeenCalled();
      });

      it('does not block POST /auth/logout for guest users', async () => {
         const blocked = await checkAndBlockGuestMutation('POST', '/auth/logout');

         expect(blocked).toBe(false);
         expect(mockedShowToast).not.toHaveBeenCalled();
      });

      it('does not block mutating requests for registered users', async () => {
         store.getState.mockReturnValue({
            auth: {
               user: {
                  id: 'user-1',
                  email: 'user@example.com',
                  role: 'LISTENER',
                  emailVerified: true,
               },
            },
         });

         const blocked = await checkAndBlockGuestMutation('POST', '/api/v1/favorites');

         expect(blocked).toBe(false);
         expect(mockedShowToast).not.toHaveBeenCalled();
      });

      it('does not block location-only PUT /auth/user/profile for guest users', async () => {
         const blocked = await checkAndBlockGuestMutation(
            'PUT',
            '/auth/user/profile',
            JSON.stringify({
               location: { latitude: '51.5074', longitude: '-0.1278' },
            })
         );

         expect(blocked).toBe(false);
         expect(mockedShowToast).not.toHaveBeenCalled();
         expect(mockReplace).not.toHaveBeenCalled();
      });

      it('blocks guest profile PUT with non-location fields', async () => {
         const blocked = await checkAndBlockGuestMutation('PUT', '/auth/user/profile', {
            firstName: 'Alex',
         });

         expect(blocked).toBe(true);
         expect(mockedShowToast).toHaveBeenCalled();
         expect(mockReplace).toHaveBeenCalledWith('/signin');
      });

      it('blocks guest PUT /api/v1/user/profile', async () => {
         const blocked = await checkAndBlockGuestMutation(
            'PUT',
            '/api/v1/user/profile',
            JSON.stringify({ avatar: 'image.png' })
         );

         expect(blocked).toBe(true);
         expect(mockedShowToast).toHaveBeenCalled();
      });

      it('blocks guest mutating requests, shows toast, and redirects to signin', async () => {
         const blocked = await checkAndBlockGuestMutation('POST', '/api/v1/favorites');

         expect(blocked).toBe(true);
         expect(mockedShowToast).toHaveBeenCalledWith({
            message: GUEST_SIGN_IN_REQUIRED_MESSAGE,
            type: 'error',
         });
         expect(store.dispatch).toHaveBeenCalled();
         expect(mockClearDeviceLocationCache).toHaveBeenCalled();
         expect(mockTeardownTrackPlayerPlayback).toHaveBeenCalled();
         expect(mockQueryClientClear).toHaveBeenCalled();
         expect(mockReplace).toHaveBeenCalledWith('/signin');
      });
   });
});
