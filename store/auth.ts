/**
 * Authentication Redux slice
 * Manages authentication state including accessToken and user data
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import * as SecureStore from 'expo-secure-store';
import { User, type AuthProvider, isAuthProvider } from '@/services/auth';
import { fetchAndStoreDeviceDetails } from '@/services/device';
import { fetchMergedUserProfile, UserProfile } from '@/services/user';
import { useOnboardingStore } from '@/store/onboarding';
import { isOnboardingProfileIncomplete } from '@/utils/onboardingProfile';
import { isGuestUser } from '@/utils/guestUser';

function applyOnboardingRequirementFromProfile(
   state: { requiresOnboarding: boolean; user: User | null },
   profile: UserProfile
): void {
   if (isGuestUser(state.user)) {
      state.requiresOnboarding = false;
      persistOnboardingPending(false);
      return;
   }

   if (isOnboardingProfileIncomplete(profile)) {
      state.requiresOnboarding = true;
      persistOnboardingPending(true);
   } else {
      state.requiresOnboarding = false;
      persistOnboardingPending(false);
   }
}

/**
 * Auth state interface
 */
export interface AuthState {
   accessToken: string | null;
   refreshToken: string | null;
   user: User | null;
   userProfile: UserProfile | null;
   profileFetched: boolean;
   isAuthenticated: boolean;
   isInitialized: boolean;
   requiresOnboarding: boolean;
   authProvider: AuthProvider | null;
}

/**
 * Initial auth state
 */
const initialState: AuthState = {
   accessToken: null,
   refreshToken: null,
   user: null,
   userProfile: null,
   profileFetched: false,
   isAuthenticated: false,
   isInitialized: false,
   requiresOnboarding: false,
   authProvider: null,
};

/**
 * Secure storage keys
 */
const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';
const USER_PROFILE_KEY = 'auth_user_profile';
const ONBOARDING_PENDING_KEY = 'onboarding_pending';
export const AUTH_PROVIDER_KEY = 'auth_provider';

function persistOnboardingPending(required: boolean): void {
   if (required) {
      SecureStore.setItemAsync(ONBOARDING_PENDING_KEY, 'true').catch((error) =>
         console.error('[Auth] Error saving onboarding pending flag:', error)
      );
   } else {
      SecureStore.deleteItemAsync(ONBOARDING_PENDING_KEY).catch((error) =>
         console.error('[Auth] Error clearing onboarding pending flag:', error)
      );
   }
}

function persistAuthSessionToSecureStore(
   accessToken: string,
   refreshToken: string,
   user: User,
   authProvider: AuthProvider,
   options?: { clearProfile?: boolean }
): void {
   SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken).catch((error) =>
      console.error('Error saving access token:', error)
   );
   SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken).catch((error) =>
      console.error('Error saving refresh token:', error)
   );
   SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)).catch((error) =>
      console.error('Error saving user data:', error)
   );
   SecureStore.setItemAsync(AUTH_PROVIDER_KEY, authProvider).catch((error) =>
      console.error('[Auth] Error saving auth provider:', error)
   );

   if (options?.clearProfile) {
      SecureStore.deleteItemAsync(USER_PROFILE_KEY).catch((error) =>
         console.error('[Auth] Error clearing previous user profile from SecureStore:', error)
      );
   }
}

function resolveRequiresOnboarding(
   user: User | null,
   userProfile: UserProfile | null,
   onboardingPending: string | null
): boolean {
   if (isGuestUser(user)) {
      return false;
   }

   return (
      onboardingPending === 'true' || isOnboardingProfileIncomplete(userProfile)
   );
}

function resolveStoredAuthProvider(
   authProviderRaw: string | null,
   user: User | null
): AuthProvider | null {
   if (authProviderRaw && isAuthProvider(authProviderRaw)) {
      return authProviderRaw;
   }

   return isGuestUser(user) ? 'guest' : null;
}

/**
 * Async thunk to initialize auth state from secure storage
 * Loads persisted accessToken, refreshToken, user data, and user profile on app startup
 */
export const initializeAuth = createAsyncThunk(
   'auth/initialize',
   async (): Promise<{
      accessToken: string | null;
      refreshToken: string | null;
      user: User | null;
      userProfile: UserProfile | null;
      requiresOnboarding: boolean;
      authProvider: AuthProvider | null;
   }> => {
      try {
         const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
         const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
         const userJson = await SecureStore.getItemAsync(USER_KEY);
         const user = userJson ? (JSON.parse(userJson) as User) : null;
         const profileJson = await SecureStore.getItemAsync(USER_PROFILE_KEY);
         const userProfile = profileJson ? (JSON.parse(profileJson) as UserProfile) : null;
         const onboardingPending = await SecureStore.getItemAsync(ONBOARDING_PENDING_KEY);
         const authProviderRaw = await SecureStore.getItemAsync(AUTH_PROVIDER_KEY);
         const authProvider = resolveStoredAuthProvider(authProviderRaw, user);

         if (accessToken) {
            return {
               accessToken,
               refreshToken,
               user,
               userProfile,
               requiresOnboarding: resolveRequiresOnboarding(
                  user,
                  userProfile,
                  onboardingPending
               ),
               authProvider,
            };
         }

         return {
            accessToken: null,
            refreshToken: null,
            user: null,
            userProfile: null,
            requiresOnboarding: false,
            authProvider: null,
         };
      } catch (error) {
         console.error('Error initializing auth:', error);
         return {
            accessToken: null,
            refreshToken: null,
            user: null,
            userProfile: null,
            requiresOnboarding: false,
            authProvider: null,
         };
      }
   }
);

/**
 * Async thunk to fetch user profile
 * Calls the user profile API and stores the result in Redux state
 * Should only be called once after successful login
 */
export const fetchUserProfile = createAsyncThunk(
   'auth/fetchUserProfile',
   async (): Promise<UserProfile> => {
      try {
         return await fetchMergedUserProfile();
      } catch (error) {
         console.error('Error fetching user profile:', error);
         throw error;
      }
   }
);

/**
 * Auth slice with reducers and actions
 */
const authSlice = createSlice({
   name: 'auth',
   initialState,
   reducers: {
      /**
       * Set authentication state after successful login or signup
       * Clears previous user profile to ensure new account's profile replaces old one
       */
      setAuth: (
         state,
         action: PayloadAction<{
            accessToken: string;
            refreshToken: string;
            user: User;
            authProvider: AuthProvider;
            requiresOnboarding?: boolean;
         }>
      ) => {
         state.accessToken = action.payload.accessToken;
         state.refreshToken = action.payload.refreshToken;
         state.user = action.payload.user;
         state.authProvider = action.payload.authProvider;
         state.isAuthenticated = true;
         state.requiresOnboarding = action.payload.requiresOnboarding === true;
         if (state.requiresOnboarding) {
            persistOnboardingPending(true);
         }

         // Clear previous user profile when new account logs in
         // This ensures multiple accounts on same device don't mix profiles
         state.userProfile = null;
         state.profileFetched = false;

         // Persist to secure store
         persistAuthSessionToSecureStore(
            action.payload.accessToken,
            action.payload.refreshToken,
            action.payload.user,
            action.payload.authProvider,
            { clearProfile: true }
         );

         // Fetch device name, platform, and persistent device UUID on login/signup
         fetchAndStoreDeviceDetails().catch((error) =>
            console.error('[Auth] Error saving device details:', error)
         );
      },
      /**
       * Clear authentication state on logout
       * Note: We keep userProfile in SecureStore even after logout so we can show
       * "Welcome Back" message for returning users. Profile is non-sensitive data.
       */
      completeOnboarding: (state) => {
         state.requiresOnboarding = false;
         persistOnboardingPending(false);
         useOnboardingStore.getState().resetOnboarding();
      },
      clearAuth: (state) => {
         state.accessToken = null;
         state.refreshToken = null;
         state.user = null;
         state.userProfile = null;
         state.profileFetched = false;
         state.isAuthenticated = false;
         state.requiresOnboarding = false;
         state.authProvider = null;

         persistOnboardingPending(false);
         useOnboardingStore.getState().resetOnboarding();

         // Clear secure store (authentication tokens and user data)
         SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch((error) =>
            console.error('Error deleting access token:', error)
         );
         SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch((error) =>
            console.error('Error deleting refresh token:', error)
         );
         SecureStore.deleteItemAsync(USER_KEY).catch((error) =>
            console.error('Error deleting user data:', error)
         );
         SecureStore.deleteItemAsync(AUTH_PROVIDER_KEY).catch((error) =>
            console.error('[Auth] Error deleting auth provider:', error)
         );
         // Keep userProfile in SecureStore for "Welcome Back" message
         // Only clear it if user explicitly deletes account
      },
   },
   extraReducers: (builder) => {
      builder
         .addCase(initializeAuth.pending, (state) => {
            state.isInitialized = false;
         })
         .addCase(initializeAuth.fulfilled, (state, action) => {
            state.accessToken = action.payload.accessToken;
            state.refreshToken = action.payload.refreshToken;
            state.user = action.payload.user;
            state.userProfile = action.payload.userProfile;
            state.profileFetched = !!action.payload.userProfile; // Mark as fetched if profile exists
            state.isAuthenticated = !!action.payload.accessToken;
            state.requiresOnboarding = isGuestUser(action.payload.user)
               ? false
               : action.payload.requiresOnboarding;
            state.authProvider = action.payload.authProvider;
            state.isInitialized = true;
         })
         .addCase(initializeAuth.rejected, (state, action) => {
            console.error('Error initializing auth:', action.error);
            state.accessToken = null;
            state.refreshToken = null;
            state.user = null;
            state.isAuthenticated = false;
            state.requiresOnboarding = false;
            state.authProvider = null;
            state.isInitialized = true;
         })
         .addCase(fetchUserProfile.pending, () => {
            // Profile is being fetched, no state change needed
         })
         .addCase(fetchUserProfile.fulfilled, (state, action) => {
            state.userProfile = action.payload;
            state.profileFetched = true;
            applyOnboardingRequirementFromProfile(state, action.payload);
            if (state.user && action.payload.email) {
               state.user = { ...state.user, email: action.payload.email };
               SecureStore.setItemAsync(USER_KEY, JSON.stringify(state.user)).catch((error) =>
                  console.error('[Auth] Error saving user data after profile fetch:', error)
               );
            }
            // Persist user profile to secure store
            const profileJson = JSON.stringify(action.payload);
            SecureStore.setItemAsync(USER_PROFILE_KEY, profileJson).catch((error) => {
               console.error('[Auth] Error saving user profile to SecureStore:', error);
            });
         })
         .addCase(fetchUserProfile.rejected, (state) => {
            // On error, mark as fetched to prevent retry loops
            // Profile will remain null, but we won't keep trying
            state.profileFetched = true;
         });
   },
});

/**
 * Helper function to check if user profile exists in SecureStore
 * Used by sign-in screen to determine welcome message
 * @returns Promise<boolean> - true if profile exists, false otherwise
 */
export async function hasStoredUserProfile(): Promise<boolean> {
   try {
      const profileJson = await SecureStore.getItemAsync(USER_PROFILE_KEY);

      // Check if it's null, undefined, or the string "null"
      if (profileJson === null || profileJson === undefined || profileJson === 'null' || (typeof profileJson === 'string' && profileJson.trim() === '')) {
         return false;
      }

      // Try to parse it to ensure it's valid JSON
      try {
         const parsed = JSON.parse(profileJson);
         return !!parsed && typeof parsed === 'object' && !Array.isArray(parsed);
      } catch (parseError) {
         console.error('[Auth] Error parsing stored profile JSON:', parseError);
         return false;
      }
   } catch (error) {
      console.error('[Auth] Error checking stored user profile:', error);
      return false;
   }
}

/**
 * Reads persisted auth provider (e.g. when Redux state is unavailable).
 */
export async function getStoredAuthProvider(): Promise<AuthProvider | null> {
   try {
      const value = await SecureStore.getItemAsync(AUTH_PROVIDER_KEY);
      return value && isAuthProvider(value) ? value : null;
   } catch (error) {
      console.error('[Auth] Error reading stored auth provider:', error);
      return null;
   }
}

export const { setAuth, clearAuth, completeOnboarding } = authSlice.actions;
export default authSlice.reducer;

