/**
 * Authentication service
 * Handles authentication API calls
 */

import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import { post, get, ApiError } from './api';
import {
   fetchAndStoreDeviceDetails,
   type DeviceDetails,
} from './device';

export type { DeviceDetails } from './device';

/**
 * How the user authenticated (stored locally for logout handling)
 */
export type AuthProvider = 'email' | 'email_registration' | 'google' | 'guest';

const AUTH_PROVIDERS: AuthProvider[] = [
   'email',
   'email_registration',
   'google',
   'guest',
];

export function isAuthProvider(value: string): value is AuthProvider {
   return (AUTH_PROVIDERS as string[]).includes(value);
}

/**
 * User interface matching API response
 */
export interface User {
   id: string;
   email: string;
   role: string;
   emailVerified: boolean;
}

/**
 * Login credentials (device is attached automatically in login())
 */
export interface LoginRequest {
   email: string;
   password: string;
}

/**
 * Login API request body sent to the server
 */
export interface LoginRequestBody extends LoginRequest {
   device: DeviceDetails;
}

/**
 * Login response from API
 */
export interface LoginResponse {
   message: string;
   accessToken: string;
   refreshToken: string;
   user: User;
}

/**
 * Guest session API request body
 */
export interface GuestAuthRequestBody {
   clientType: 'mobile';
   device: DeviceDetails;
}

/**
 * Signup request payload for listener registration
 */
export interface SignupRequest {
   email: string;
   password: string;
   confirmPassword: string;
   role?: 'LISTENER';
   address: string;
   contact: string;
}

/**
 * Signup response from API — OTP is sent; tokens arrive after verification
 */
export interface SignupResponse {
   message: string;
   otpSent?: boolean;
   user: User;
}

/**
 * OTP verification input (device is attached automatically)
 */
export interface VerifyOtpRequest {
   email: string;
   otp: string;
}

/**
 * Registration OTP verification API request body
 */
export interface VerifyOtpRequestBody extends VerifyOtpRequest {
   device: DeviceDetails;
}

/**
 * OTP verification response from API (same structure as login)
 */
export interface VerifyOtpResponse {
   message: string;
   accessToken: string;
   refreshToken: string;
   user: User;
}

/**
 * Create or resume an anonymous guest session
 * Calls POST /auth/guest with mobile client type and device context
 */
export async function createGuestSession(): Promise<LoginResponse> {
   try {
      const device = await fetchAndStoreDeviceDetails();
      const body: GuestAuthRequestBody = { clientType: 'mobile', device };

      const response = await post<LoginResponse>('/auth/guest', body, false, true);
      return response.data;
   } catch (error) {
      console.error('[Auth Service] Guest session error', {
         error,
         errorType: error instanceof Error ? error.constructor.name : typeof error,
         errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `Guest session failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

/**
 * Login function
 * Calls POST /auth/login with email and password
 * @param credentials - Email and password
 * @returns Promise with login response containing accessToken, refreshToken, and user
 * @throws ApiError if login fails
 */
export async function login(
   credentials: LoginRequest
): Promise<LoginResponse> {
   try {
      const device = await fetchAndStoreDeviceDetails();
      const body: LoginRequestBody = { ...credentials, device };

      // Use auth API (port 8080) for login endpoint
      const response = await post<LoginResponse>('/auth/login', body, false, true);
      return response.data;
   } catch (error) {
      console.error('[Auth Service] Login error', {
         error,
         errorType: error instanceof Error ? error.constructor.name : typeof error,
         errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

/**
 * Signup function
 * Calls POST /auth/register with listener registration fields
 */
export async function signup(
   credentials: SignupRequest
): Promise<SignupResponse> {
   try {
      const body: SignupRequest = {
         ...credentials,
         role: 'LISTENER',
      };
      const response = await post<SignupResponse>('/auth/register', body, false, true);
      return response.data;
   } catch (error) {
      console.error('[Auth Service] Signup error', {
         error,
         errorType: error instanceof Error ? error.constructor.name : typeof error,
         errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `Signup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

/**
 * Verify registration OTP function
 * Calls POST /auth/verify-registration-otp with email and OTP
 * @param request - Email and OTP
 * @returns Promise with verification response containing accessToken, refreshToken, and user
 * @throws ApiError if verification fails
 */
export async function verifyRegistrationOtp(
   request: VerifyOtpRequest
): Promise<VerifyOtpResponse> {
   try {
      const device = await fetchAndStoreDeviceDetails();
      const body: VerifyOtpRequestBody = { ...request, device };

      // Use auth API (port 8080) for OTP verification endpoint
      const response = await post<VerifyOtpResponse>(
         '/auth/verify-registration-otp',
         body,
         false,
         true
      );
      return response.data;
   } catch (error) {
      console.error('[Auth Service] OTP verification error', {
         error,
         errorType: error instanceof Error ? error.constructor.name : typeof error,
         errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `OTP verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

/**
 * OTP purposes accepted by POST /auth/resend-otp
 */
export type ResendOtpPurpose =
   | 'REGISTRATION'
   | 'EMAIL_UPDATE'
   | 'PASSWORD_UPDATE'
   | 'DEVICE_REMOVAL';

/**
 * Resend OTP request payload
 */
export interface ResendOtpRequest {
   email: string;
   purpose: ResendOtpPurpose;
}

/**
 * Resend OTP response
 */
export interface ResendOtpResponse {
   message: string;
}

/**
 * Resend registration OTP function
 * Calls POST /auth/resend-otp with user's email and REGISTRATION purpose
 * @param request - Resend OTP request containing email
 * @returns Promise with response message
 * @throws ApiError if resend fails
 */
export async function resendRegistrationOTP(
   request: Pick<ResendOtpRequest, 'email'>
): Promise<ResendOtpResponse> {
   try {
      const body: ResendOtpRequest = {
         email: request.email,
         purpose: 'REGISTRATION',
      };
      const response = await post<ResendOtpResponse>(
         '/auth/resend-otp',
         body,
         false,
         true
      );
      return response.data;
   } catch (error) {
      console.error('[Auth Service] Resend OTP error', {
         error,
         errorType: error instanceof Error ? error.constructor.name : typeof error,
         errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `Resend OTP failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

/**
 * Request password change OTP request payload
 */
export type RequestPasswordChangeOtpRequest = Record<string, never>;

/**
 * Request password change OTP response
 */
export interface RequestPasswordChangeOtpResponse {
   message: string;
}

/**
 * Verify password change OTP request payload
 */
export interface VerifyPasswordChangeOtpRequest {
   otp: string;
}

/**
 * Verify password change OTP response
 */
export interface VerifyPasswordChangeOtpResponse {
   message: string;
}

/**
 * Request email update OTP request payload
 */
export interface RequestEmailUpdateOtpRequest {
   email: string;
}

/**
 * Request email update OTP response
 */
export interface RequestEmailUpdateOtpResponse {
   message: string;
}

/**
 * Verify email update OTP request payload
 */
export interface VerifyEmailUpdateOtpRequest {
   otp: string;
}

/**
 * Verify email update OTP response
 */
export interface VerifyEmailUpdateOtpResponse {
   message: string;
}

/**
 * Request password change OTP function
 * Calls GET /auth/request-password-change-otp
 * Sends OTP to user's current email
 * @returns Promise with response message
 * @throws ApiError if request fails
 */
export async function requestPasswordChangeOtp(): Promise<RequestPasswordChangeOtpResponse> {
   try {
      // Use auth API (port 8080) and require authentication
      const response = await get<RequestPasswordChangeOtpResponse>(
         '/auth/request-password-change-otp',
         true,
         true
      );
      return response.data;
   } catch (error) {
      console.error('[Auth Service] Request password change OTP error', {
         error,
         errorType: error instanceof Error ? error.constructor.name : typeof error,
         errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `Request password change OTP failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

/**
 * Verify password change OTP function
 * Calls POST /auth/verify-password-change-otp
 * @param request - OTP
 * @returns Promise with verification response
 * @throws ApiError if verification fails
 */
export async function verifyPasswordChangeOtp(
   request: VerifyPasswordChangeOtpRequest
): Promise<VerifyPasswordChangeOtpResponse> {
   try {
      // Use auth API (port 8080) and require authentication
      const response = await post<VerifyPasswordChangeOtpResponse>(
         '/auth/verify-password-change-otp',
         request,
         true,
         true
      );
      return response.data;
   } catch (error) {
      console.error('[Auth Service] Verify password change OTP error', {
         error,
         errorType: error instanceof Error ? error.constructor.name : typeof error,
         errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `Verify password change OTP failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

/**
 * Request email update OTP function
 * Calls GET /auth/request-email-update-otp?email={email}
 * Sends OTP to specified email
 * @param request - Email address
 * @returns Promise with response message
 * @throws ApiError if request fails
 */
export async function requestEmailUpdateOtp(
   request: RequestEmailUpdateOtpRequest
): Promise<RequestEmailUpdateOtpResponse> {
   try {
      // Use auth API (port 8080) and require authentication
      // Pass email as query parameter
      const response = await get<RequestEmailUpdateOtpResponse>(
         `/auth/request-email-update-otp?email=${encodeURIComponent(request.email)}`,
         true,
         true
      );
      return response.data;
   } catch (error) {
      console.error('[Auth Service] Request email update OTP error', {
         error,
         errorType: error instanceof Error ? error.constructor.name : typeof error,
         errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `Request email update OTP failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

/**
 * Verify email update OTP function
 * Calls POST /auth/verify-email-update-otp
 * @param request - OTP
 * @returns Promise with verification response
 * @throws ApiError if verification fails
 */
export async function verifyEmailUpdateOtp(
   request: VerifyEmailUpdateOtpRequest
): Promise<VerifyEmailUpdateOtpResponse> {
   try {
      // Use auth API (port 8080) and require authentication
      const response = await post<VerifyEmailUpdateOtpResponse>(
         '/auth/verify-email-update-otp',
         request,
         true,
         true
      );
      return response.data;
   } catch (error) {
      console.error('[Auth Service] Verify email update OTP error', {
         error,
         errorType: error instanceof Error ? error.constructor.name : typeof error,
         errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `Verify email update OTP failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

/**
 * Change password request payload
 */
export interface ChangePasswordRequest {
   currentPassword: string;
   newPassword: string;
}

/**
 * Change password response
 */
export interface ChangePasswordResponse {
   message: string;
}

/**
 * Update email request payload
 */
export interface UpdateEmailRequest {
   newEmail: string;
}

/**
 * Update email response
 */
export interface UpdateEmailResponse {
   message: string;
}

/**
 * Change password function
 * Calls POST /auth/change-password with new password
 * Requires OTP verification to be completed first
 * @param request - New password
 * @returns Promise with response message
 * @throws ApiError if password change fails
 */
export async function changePassword(
   request: ChangePasswordRequest
): Promise<ChangePasswordResponse> {
   try {
      // Use auth API (port 8080) and require authentication
      const response = await post<ChangePasswordResponse>(
         '/auth/change-password',
         request,
         true,
         true
      );
      return response.data;
   } catch (error) {
      console.error('[Auth Service] Change password error', {
         error,
         errorType: error instanceof Error ? error.constructor.name : typeof error,
         errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `Change password failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

/**
 * Update email function
 * Calls POST /auth/update-email with new email
 * Requires OTP verification to be completed first
 * @param request - New email
 * @returns Promise with response message
 * @throws ApiError if email update fails
 */
export async function updateEmail(
   request: UpdateEmailRequest
): Promise<UpdateEmailResponse> {
   try {
      // Use auth API (port 8080) and require authentication
      const response = await post<UpdateEmailResponse>(
         '/auth/update-email',
         request,
         true,
         true
      );
      return response.data;
   } catch (error) {
      console.error('[Auth Service] Update email error', {
         error,
         errorType: error instanceof Error ? error.constructor.name : typeof error,
         errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `Update email failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

/**
 * Logout request payload
 */
export interface LogoutRequest {
   refreshToken: string;
}

/**
 * Google OAuth API request body (device is attached automatically in googleAuth())
 */
export interface GoogleAuthRequestBody {
   token: string;
   device: DeviceDetails;
}

/**
 * Google OAuth response from API (same structure as login)
 */
export interface GoogleAuthResponse {
   message: string;
   accessToken: string;
   refreshToken: string;
   user: User;
   /** True when the Google account was just registered on the server */
   isNewUser?: boolean;
}

/**
 * Logout response from API
 */
export interface LogoutResponse {
   message: string;
}

/**
 * Clears the native Google Sign-In session so the account picker appears on next sign-in.
 * Does not throw — safe to call during logout.
 */
export async function revokeGoogleSignInSession(): Promise<void> {
   try {
      configureGoogleSignIn();
      await GoogleSignin.signOut();
      await GoogleSignin.revokeAccess();
   } catch (error) {
      console.warn('[Auth Service] Failed to revoke Google Sign-In session:', error);
   }
}

/**
 * Initialize Google Sign-In configuration
 * Should be called once when the app starts
 */
export function configureGoogleSignIn(): void {
   // Get Google OAuth client IDs from environment variables
   const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
   const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

   if (!webClientId) {
      console.warn('[Auth Service] Google Sign-In web client ID is not configured. Please set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID environment variable.');
      return;
   }

   // Configure Google Sign-In
   GoogleSignin.configure({
      webClientId, // Required for getting the idToken on Android
      iosClientId, // Optional, for iOS
      offlineAccess: false, // If you want to access Google API on behalf of the user FROM YOUR SERVER
      forceCodeForRefreshToken: false, // [Android] related to `serverAuthCode`, read the docs link below *.
      scopes: ['profile', 'email'], // What API you want to access on behalf of the user,
   });
}

/**
 * Google OAuth function
 * Initiates Google Sign-In flow and sends token to server
 * @returns Promise with Google auth response containing accessToken, refreshToken, and user
 * @throws ApiError if Google auth fails
 */
export async function googleAuth(): Promise<GoogleAuthResponse> {
   try {
      // Ensure Google Sign-In is configured
      configureGoogleSignIn();

      // Check if Google Play Services are available (Android only)
      if (Platform.OS === 'android') {
         await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      // Sign in with Google
      const userInfo = await GoogleSignin.signIn();

      // Check if sign-in was cancelled or failed
      if (!userInfo || !userInfo.data) {
         throw new Error('Google sign-in was cancelled or failed');
      }

      // Get the ID token
      const idToken = userInfo.data.idToken;
      if (!idToken) {
         throw new Error('Failed to retrieve Google ID token');
      }

      const device = await fetchAndStoreDeviceDetails();
      const body: GoogleAuthRequestBody = { token: idToken, device };

      // Send token and device to server
      const response = await post<GoogleAuthResponse>(
         '/auth/google',
         body,
         false,
         true
      );

      return response.data;
   } catch (error: unknown) {
      console.error('[Auth Service] Google auth error', {
         error,
         errorType: error instanceof Error ? error.constructor.name : typeof error,
         errorMessage: error instanceof Error ? error.message : String(error),
      });

      // Handle Google Sign-In specific errors
      if (error && typeof error === 'object' && 'code' in error) {
         const googleError = error as { code: string; message?: string };
         if (googleError.code === 'SIGN_IN_CANCELLED') {
            throw new Error('Google sign-in was cancelled');
         }
         if (googleError.code === 'IN_PROGRESS') {
            throw new Error('Google sign-in is already in progress');
         }
         if (googleError.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
            throw new Error('Google Play Services are not available. Please update Google Play Services.');
         }
      }

      if (error instanceof ApiError) {
         throw error;
      }

      // Re-throw user-friendly errors
      if (error instanceof Error) {
         throw error;
      }

      throw new Error(
         `Google authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

/**
 * Logout function
 * Calls POST /auth/logout with refreshToken
 * @param refreshToken - Refresh token to invalidate on server
 * @returns Promise with logout response
 * @throws ApiError if logout fails
 */
export async function logout(
   refreshToken: string
): Promise<LogoutResponse> {
   try {
      // Use auth API (port 8080) for logout endpoint
      // Do NOT include Bearer token (useAuth=false)
      const response = await post<LogoutResponse>(
         '/auth/logout',
         { refreshToken },
         false,
         true
      );
      return response.data;
   } catch (error) {
      console.error('[Auth Service] Logout error', {
         error,
         errorType: error instanceof Error ? error.constructor.name : typeof error,
         errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ApiError) {
         throw error;
      }
      throw new Error(
         `Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
   }
}

