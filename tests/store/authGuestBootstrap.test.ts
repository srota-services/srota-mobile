import { configureStore } from '@reduxjs/toolkit';
import * as SecureStore from 'expo-secure-store';
import authReducer, { initializeAuth } from '@/store/auth';
import { createGuestSession } from '@/services/auth';

jest.mock('expo-secure-store', () => ({
   getItemAsync: jest.fn(),
   setItemAsync: jest.fn(() => Promise.resolve()),
   deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/services/auth', () => ({
   createGuestSession: jest.fn(),
   isAuthProvider: (value: string) =>
      ['email', 'email_registration', 'google', 'guest'].includes(value),
}));

const mockedGetItemAsync = SecureStore.getItemAsync as jest.MockedFunction<
   typeof SecureStore.getItemAsync
>;
const mockedCreateGuestSession = createGuestSession as jest.MockedFunction<
   typeof createGuestSession
>;

function createTestStore() {
   return configureStore({
      reducer: {
         auth: authReducer,
      },
   });
}

describe('initializeAuth session restore', () => {
   beforeEach(() => {
      jest.clearAllMocks();
      mockedGetItemAsync.mockResolvedValue(null);
   });

   it('returns unauthenticated when no stored token exists', async () => {
      const store = createTestStore();

      await store.dispatch(initializeAuth());

      const state = store.getState().auth;
      expect(mockedCreateGuestSession).not.toHaveBeenCalled();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isInitialized).toBe(true);
      expect(state.authProvider).toBeNull();
   });

   it('restores stored registered session without calling guest endpoint', async () => {
      mockedGetItemAsync.mockImplementation(async (key: string) => {
         if (key === 'auth_access_token') {
            return 'stored-access-token';
         }
         if (key === 'auth_refresh_token') {
            return 'stored-refresh-token';
         }
         if (key === 'auth_user') {
            return JSON.stringify({
               id: 'user-1',
               email: 'user@example.com',
               role: 'LISTENER',
               emailVerified: true,
            });
         }
         if (key === 'auth_provider') {
            return 'email';
         }
         return null;
      });

      const store = createTestStore();
      await store.dispatch(initializeAuth());

      expect(mockedCreateGuestSession).not.toHaveBeenCalled();
      expect(store.getState().auth.authProvider).toBe('email');
      expect(store.getState().auth.isAuthenticated).toBe(true);
   });

   it('restores stored guest session without calling guest endpoint', async () => {
      mockedGetItemAsync.mockImplementation(async (key: string) => {
         if (key === 'auth_access_token') {
            return 'guest-access-token';
         }
         if (key === 'auth_refresh_token') {
            return 'guest-refresh-token';
         }
         if (key === 'auth_user') {
            return JSON.stringify({
               id: 'guest-user-1',
               email: 'guest@example.com',
               role: 'GUEST',
               emailVerified: true,
            });
         }
         if (key === 'auth_provider') {
            return 'guest';
         }
         return null;
      });

      const store = createTestStore();
      await store.dispatch(initializeAuth());

      expect(mockedCreateGuestSession).not.toHaveBeenCalled();
      expect(store.getState().auth.authProvider).toBe('guest');
      expect(store.getState().auth.isAuthenticated).toBe(true);
      expect(store.getState().auth.requiresOnboarding).toBe(false);
   });
});
