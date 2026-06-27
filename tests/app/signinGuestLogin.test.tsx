import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SignInScreen from '@/app/signin';
import authReducer from '@/store/auth';
import settingsReducer from '@/store/settings';
import { createGuestSession } from '@/services/auth';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { hasStoredUserProfile } from '@/store/auth';

jest.mock('expo-router', () => ({
   Stack: {
      Screen: () => null,
   },
   router: {
      push: jest.fn(),
      replace: jest.fn(),
   },
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
   GoogleSignin: {
      configure: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(() => Promise.resolve()),
      revokeAccess: jest.fn(() => Promise.resolve()),
   },
}));

jest.mock('expo-secure-store', () => ({
   getItemAsync: jest.fn(() => Promise.resolve(null)),
   setItemAsync: jest.fn(() => Promise.resolve()),
   deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/services/device', () => ({
   fetchAndStoreDeviceDetails: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/services/location', () => ({
   fetchDeviceLocationInMemory: jest.fn(() => Promise.resolve(null)),
   syncUserLocationToProfile: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/services/auth', () => ({
   login: jest.fn(),
   googleAuth: jest.fn(),
   createGuestSession: jest.fn(),
   isAuthProvider: (value: string) =>
      ['email', 'email_registration', 'google', 'guest'].includes(value),
}));

jest.mock('@/store/auth', () => {
   const actual = jest.requireActual<typeof import('@/store/auth')>('@/store/auth');
   return {
      __esModule: true,
      ...actual,
      default: actual.default,
      hasStoredUserProfile: jest.fn(() => Promise.resolve(false)),
   };
});

const mockedCreateGuestSession = createGuestSession as jest.MockedFunction<
   typeof createGuestSession
>;
const mockedHasStoredUserProfile = hasStoredUserProfile as jest.MockedFunction<
   typeof hasStoredUserProfile
>;

function renderSignInScreen() {
   const store = configureStore({
      reducer: {
         auth: authReducer,
         settings: settingsReducer,
      },
   });

   const view = render(
      <Provider store={store}>
         <ThemeProvider>
            <SignInScreen />
         </ThemeProvider>
      </Provider>
   );

   return { store, ...view };
}

describe('SignInScreen guest login', () => {
   beforeEach(() => {
      jest.clearAllMocks();
      mockedHasStoredUserProfile.mockResolvedValue(false);
      mockedCreateGuestSession.mockResolvedValue({
         message: 'Guest session created successfully',
         accessToken: 'guest-access-token',
         refreshToken: 'guest-refresh-token',
         user: {
            id: 'guest-user-1',
            email: 'guest@example.com',
            role: 'GUEST',
            emailVerified: true,
         },
      });
   });

   it('creates a guest session and stores auth state when Login as Guest is pressed', async () => {
      const { store, getByTestId } = renderSignInScreen();

      fireEvent.press(getByTestId('guest-login-button'));

      await waitFor(() => {
         expect(mockedCreateGuestSession).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
         expect(store.getState().auth.isAuthenticated).toBe(true);
      });

      expect(store.getState().auth.authProvider).toBe('guest');
      expect(store.getState().auth.accessToken).toBe('guest-access-token');
      expect(store.getState().auth.user?.role).toBe('GUEST');
   });
});
