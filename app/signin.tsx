import React, { useState, useCallback, useEffect } from 'react';
import {
   View,
   Text,
   StyleSheet,
   ScrollView,
   TouchableOpacity,
   Platform,
   KeyboardAvoidingView,
   Keyboard,
   ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import { TextInput } from '@/components/TextInput';
import { SecondaryButton } from '@/components/SecondaryButton';
import { spacing, typography, borderRadius } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { login, googleAuth, createGuestSession } from '@/services/auth';
import { parseIsNewUserFlag } from '@/utils/onboardingProfile';
import {
   fetchDeviceLocationInMemory,
   syncUserLocationToProfile,
} from '@/services/location';
import { setAuth, fetchUserProfile, hasStoredUserProfile } from '@/store/auth';
import { AppDispatch } from '@/store';
import { ApiError } from '@/services/api';
import { getAuthApiErrorMessage, isDeviceLimitExceededError } from '@/utils/authApiErrors';

/**
 * Sign in screen with email/password inputs, Google login, and navigation links
 */
export default function SignInScreen() {
   const { colors } = useTheme();
   const styles = useThemedStyles((t) =>
      StyleSheet.create({
   container: {
      flex: 1,
      backgroundColor: t.colors.background.dark,
   },
   keyboardAvoid: {
      flex: 1,
   },
   scrollView: {
      flex: 1,
   },
   scrollContent: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.xl,
   },
   header: {
      marginBottom: spacing.xl,
      alignItems: 'center',
   },
   title: {
      fontSize: typography.fontSize['4xl'],
      fontWeight: '700',
      color: t.colors.text.dark,
      marginBottom: spacing.sm,
      textAlign: 'center',
      ...Platform.select({
         ios: {
            fontFamily: 'System',
            fontWeight: '700',
         },
         android: {
            fontFamily: 'sans-serif-bold',
         },
      }),
   },
   subtitle: {
      fontSize: typography.fontSize.base,
      color: t.colors.text.secondaryDark,
      textAlign: 'center',
      ...Platform.select({
         ios: {
            fontFamily: 'System',
            fontWeight: '400',
         },
         android: {
            fontFamily: 'sans-serif',
         },
      }),
   },
   form: {
      flex: 1,
      justifyContent: 'center',
   },
   errorContainer: {
      marginBottom: spacing.md,
      marginTop: -spacing.sm,
   },
   errorText: {
      fontSize: typography.fontSize.sm,
      color: t.colors.error,
      textAlign: 'center',
      ...Platform.select({
         ios: {
            fontFamily: 'System',
            fontWeight: '400',
         },
         android: {
            fontFamily: 'sans-serif',
         },
      }),
   },
   forgotPasswordLink: {
      alignSelf: 'flex-end',
      marginBottom: spacing.lg,
      marginTop: -spacing.sm,
   },
   linkText: {
      fontSize: typography.fontSize.sm,
      color: t.colors.primary[400],
      ...Platform.select({
         ios: {
            fontFamily: 'System',
            fontWeight: '500',
         },
         android: {
            fontFamily: 'sans-serif-medium',
         },
      }),
   },
   authButton: {
      marginBottom: spacing.lg,
   },
   divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: spacing.lg,
   },
   dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: t.colors.border.light,
   },
   dividerText: {
      fontSize: typography.fontSize.sm,
      color: t.colors.text.secondaryDark,
      marginHorizontal: spacing.md,
      ...Platform.select({
         ios: {
            fontFamily: 'System',
            fontWeight: '400',
         },
         android: {
            fontFamily: 'sans-serif',
         },
      }),
   },
   googleButton: {
      flexDirection: 'row',
      borderRadius: borderRadius.md,
      height: 48,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.lg,
      backgroundColor: t.colors.background.input,
   },
   googleButtonDisabled: {
      opacity: 0.6,
   },
   googleIcon: {
      marginRight: spacing.sm,
   },
   googleButtonText: {
      fontSize: typography.fontSize.base,
      fontWeight: '500',
      color: t.colors.text.dark,
      ...Platform.select({
         ios: {
            fontFamily: 'System',
            fontWeight: '500',
         },
         android: {
            fontFamily: 'sans-serif-medium',
         },
      }),
   },
   guestButton: {
      marginBottom: spacing.lg,
   },
   signUpLinkContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.md,
   },
   signUpLinkText: {
      fontSize: typography.fontSize.base,
      color: t.colors.text.secondaryDark,
      ...Platform.select({
         ios: {
            fontFamily: 'System',
            fontWeight: '400',
         },
         android: {
            fontFamily: 'sans-serif',
         },
      }),
   },
   signUpLink: {
      fontSize: typography.fontSize.base,
      color: t.colors.primary[400],
      fontWeight: '600',
      ...Platform.select({
         ios: {
            fontFamily: 'System',
            fontWeight: '600',
         },
         android: {
            fontFamily: 'sans-serif-medium',
         },
      }),
   },
      })
   );

   const dispatch = useDispatch<AppDispatch>();
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [isLoadingSignIn, setIsLoadingSignIn] = useState(false);
   const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
   const [isLoadingGuest, setIsLoadingGuest] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [hasStoredProfile, setHasStoredProfile] = useState<boolean | null>(null);

   // Check if user profile exists in storage on component mount
   useEffect(() => {
      const checkStoredProfile = async () => {
         try {
            const hasProfile = await hasStoredUserProfile();
            setHasStoredProfile(hasProfile);
         } catch (error) {
            console.error('[SignIn] Error checking stored profile:', error);
            setHasStoredProfile(false);
         }
      };

      checkStoredProfile();
   }, []);

   const handleSignIn = useCallback(async () => {
      // Basic validation
      if (!email.trim() || !password.trim()) {
         setError('Please enter both email and password');
         return;
      }

      Keyboard.dismiss();
      setError(null);

      setIsLoadingSignIn(true);

      try {
         // Call login API
         const response = await login({ email: email.trim(), password });

         // Store auth state in Redux
         dispatch(
            setAuth({
               accessToken: response.accessToken,
               refreshToken: response.refreshToken,
               user: response.user,
               authProvider: 'email',
            })
         );

         // Fetch user profile after successful login
         try {
            await dispatch(fetchUserProfile()).unwrap();
         } catch (profileError) {
            // Log error but don't block navigation - profile fetch failure shouldn't prevent login
            console.error('[SignIn] Failed to fetch user profile:', profileError);
         }

         void fetchDeviceLocationInMemory().then(() => syncUserLocationToProfile());

         // Navigation is handled centrally by the auth guard in `app/_layout.tsx`
      } catch (err) {
         // Handle API errors
         if (err instanceof ApiError) {
            if (isDeviceLimitExceededError(err.data)) {
               return;
            }
            if (err.status === 401) {
               setError('Invalid email or password');
            } else if (err.status === 400) {
               setError('Please check your email and password');
            } else {
               const errorData = err.data;
               setError(
                  getAuthApiErrorMessage(errorData) ||
                     (errorData as { message?: string } | undefined)?.message ||
                     'Login failed. Please try again.'
               );
            }
         } else {
            const errorMessage =
               err instanceof Error ? err.message : 'Unknown error';
            console.error('[SignIn] Non-API error:', errorMessage);

            // Provide helpful error message for network issues
            let userMessage = 'Network error. Please check your connection and try again.';
            if (errorMessage.includes('Network request failed')) {
               userMessage = 'Cannot connect to server. If testing on a physical device, set EXPO_PUBLIC_API_AUTH_URL to your computer\'s IP address (e.g., http://192.168.1.100:8080)';
            }

            setError(userMessage);
         }
      } finally {
         setIsLoadingSignIn(false);
      }
   }, [email, password, dispatch]);

   const handleGoogleLogin = useCallback(async () => {
      Keyboard.dismiss();
      setError(null);
      setIsLoadingGoogle(true);

      try {
         // Call Google OAuth API
         const response = await googleAuth();
         const requiresOnboarding = parseIsNewUserFlag(
            response as unknown as Record<string, unknown>
         );

         // Store auth state in Redux
         dispatch(
            setAuth({
               accessToken: response.accessToken,
               refreshToken: response.refreshToken,
               user: response.user,
               authProvider: 'google',
               requiresOnboarding,
            })
         );

         // Fetch user profile after successful Google sign-in
         try {
            await dispatch(fetchUserProfile()).unwrap();
         } catch (profileError) {
            console.error('[SignIn] Failed to fetch user profile:', profileError);
         }

         void fetchDeviceLocationInMemory().then(() => syncUserLocationToProfile());

         // Navigation is handled centrally by the auth guard in `app/_layout.tsx`
      } catch (err) {
         // Handle API errors
         if (err instanceof ApiError) {
            if (isDeviceLimitExceededError(err.data)) {
               return;
            }
            if (err.status === 401) {
               setError('Google authentication failed. Please try again.');
            } else if (err.status === 400) {
               setError('Invalid Google token. Please try again.');
            } else {
               const errorData = err.data;
               setError(
                  getAuthApiErrorMessage(errorData) ||
                     (errorData as { message?: string } | undefined)?.message ||
                     'Google login failed. Please try again.'
               );
            }
         } else {
            const errorMessage =
               err instanceof Error ? err.message : 'Unknown error';
            console.error('[SignIn] Google OAuth error:', errorMessage);

            // Provide helpful error messages
            let userMessage = 'Google sign-in failed. Please try again.';
            if (errorMessage.includes('cancelled') || errorMessage.includes('cancel')) {
               userMessage = 'Google sign-in was cancelled';
            } else if (errorMessage.includes('not configured')) {
               userMessage = 'Google sign-in is not configured. Please contact support.';
            } else if (errorMessage.includes('Network request failed')) {
               userMessage = 'Cannot connect to server. If testing on a physical device, set EXPO_PUBLIC_AUTH_API_URL to your computer\'s IP address (e.g., http://192.168.1.100:8080)';
            }

            setError(userMessage);
         }
      } finally {
         setIsLoadingGoogle(false);
      }
   }, [dispatch]);

   const handleGuestLogin = useCallback(async () => {
      Keyboard.dismiss();
      setError(null);
      setIsLoadingGuest(true);

      try {
         const response = await createGuestSession();

         dispatch(
            setAuth({
               accessToken: response.accessToken,
               refreshToken: response.refreshToken,
               user: response.user,
               authProvider: 'guest',
            })
         );
      } catch (err) {
         if (err instanceof ApiError) {
            if (isDeviceLimitExceededError(err.data)) {
               return;
            }

            const errorData = err.data;
            setError(
               getAuthApiErrorMessage(errorData) ||
                  (errorData as { message?: string } | undefined)?.message ||
                  'Guest login failed. Please try again.'
            );
         } else {
            const errorMessage =
               err instanceof Error ? err.message : 'Unknown error';
            console.error('[SignIn] Guest login error:', errorMessage);

            let userMessage = 'Network error. Please check your connection and try again.';
            if (errorMessage.includes('Network request failed')) {
               userMessage =
                  'Cannot connect to server. If testing on a physical device, set EXPO_PUBLIC_AUTH_API_URL to your computer\'s IP address (e.g., http://192.168.1.100:8080)';
            }

            setError(userMessage);
         }
      } finally {
         setIsLoadingGuest(false);
      }
   }, [dispatch]);

   const handleForgotPassword = useCallback(() => {
      Keyboard.dismiss();
      console.log('Forgot password pressed');
      // TODO: Implement forgot password flow
   }, []);

   const handleNavigateToSignUp = useCallback(() => {
      Keyboard.dismiss();
      router.push('/signup');
   }, []);

   return (
      <>
         <Stack.Screen
            options={{
               headerShown: false,
               contentStyle: {
                  backgroundColor: colors.background.dark,
               },
            }}
         />

         <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <KeyboardAvoidingView
               style={styles.keyboardAvoid}
               behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
               <ScrollView
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
               >
                  {/* Header */}
                  <View style={styles.header}>
                     <Text style={styles.title}>
                        {hasStoredProfile === null
                           ? 'Welcome'
                           : hasStoredProfile
                              ? 'Welcome Back'
                              : 'Welcome'}
                     </Text>
                     <Text style={styles.subtitle}>
                        Sign in to continue to your account
                     </Text>
                  </View>

                  {/* Form */}
                  <View style={styles.form}>
                     <TextInput
                        label="Email"
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Enter your email"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        icon="mail-outline"
                        testID="signin-email-input"
                     />

                     <TextInput
                        label="Password"
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Enter your password"
                        secureTextEntry={true}
                        autoCapitalize="none"
                        icon="lock-closed-outline"
                        testID="signin-password-input"
                     />

                     {/* Error Message */}
                     {error && (
                        <View style={styles.errorContainer}>
                           <Text style={styles.errorText}>{error}</Text>
                        </View>
                     )}

                     {/* Forgot Password Link */}
                     <TouchableOpacity
                        onPress={handleForgotPassword}
                        style={styles.forgotPasswordLink}
                        activeOpacity={0.7}
                     >
                        <Text style={styles.linkText}>Forgot Password?</Text>
                     </TouchableOpacity>

                     {/* Sign In Button */}
                     <SecondaryButton
                        title="Sign In"
                        onPress={handleSignIn}
                        loading={isLoadingSignIn}
                        disabled={isLoadingSignIn || isLoadingGoogle || isLoadingGuest}
                        style={styles.authButton}
                        testID="signin-button"
                     />

                     {/* Divider */}
                     <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>OR</Text>
                        <View style={styles.dividerLine} />
                     </View>

                     {/* Google Login Button */}
                     <TouchableOpacity
                        style={[styles.googleButton, isLoadingGoogle && styles.googleButtonDisabled]}
                        onPress={handleGoogleLogin}
                        activeOpacity={0.8}
                        disabled={isLoadingSignIn || isLoadingGoogle || isLoadingGuest}
                        testID="google-login-button"
                     >
                        {isLoadingGoogle ? (
                           <ActivityIndicator color={colors.text.dark} />
                        ) : (
                           <>
                              <Ionicons
                                 name="logo-google"
                                 size={20}
                                 color={colors.text.dark}
                                 style={styles.googleIcon}
                              />
                              <Text style={styles.googleButtonText}>
                                 Continue with Google
                              </Text>
                           </>
                        )}
                     </TouchableOpacity>

                     <SecondaryButton
                        title="Login as Guest"
                        onPress={handleGuestLogin}
                        loading={isLoadingGuest}
                        disabled={isLoadingSignIn || isLoadingGoogle || isLoadingGuest}
                        variant="outlined"
                        style={styles.guestButton}
                        testID="guest-login-button"
                     />

                     {/* Sign Up Link */}
                     <View style={styles.signUpLinkContainer}>
                        <Text style={styles.signUpLinkText}>
                           Don&apos;t have an account?{' '}
                        </Text>
                        <TouchableOpacity
                           onPress={handleNavigateToSignUp}
                           activeOpacity={0.7}
                        >
                           <Text style={styles.signUpLink}>Sign Up</Text>
                        </TouchableOpacity>
                     </View>
                  </View>
               </ScrollView>
            </KeyboardAvoidingView>
         </SafeAreaView>
      </>
   );
}

