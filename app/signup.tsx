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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, type Href } from 'expo-router';
import { useSelector } from 'react-redux';
import { TextInput } from '@/components/TextInput';
import { SecondaryButton } from '@/components/SecondaryButton';
import { spacing, typography } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { signup } from '@/services/auth';
import { RootState } from '@/store';
import { ApiError } from '@/services/api';
import {
   getSignupWizardProgress,
   persistSignupWizardProgress,
   resolveSignupWizardRoute,
   signupWizardRouteToHref,
} from '@/utils/signupWizardStorage';
import { useSignupWizardStepPersistence } from '@/hooks/useSignupWizardStepPersistence';
import {
   validateIndianContact,
   validateRegistrationPassword,
} from '@/utils/registrationValidation';

/**
 * Sign up screen with email, password, and confirm password inputs
 */
export default function SignUpScreen() {
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
   authButton: {
      marginTop: spacing.md,
      marginBottom: spacing.lg,
   },
   signInLinkContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.md,
   },
   signInLinkText: {
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
   signInLink: {
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

   const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
   const requiresOnboarding = useSelector(
      (state: RootState) => state.auth.requiresOnboarding
   );
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [confirmPassword, setConfirmPassword] = useState('');
   const [address, setAddress] = useState('');
   const [contact, setContact] = useState('');
   const [isLoading, setIsLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [draftRestored, setDraftRestored] = useState(false);

   useSignupWizardStepPersistence('signup');

   useEffect(() => {
      if (draftRestored) {
         return;
      }

      const draft = getSignupWizardProgress()?.signupDraft;
      if (draft) {
         setEmail(draft.email);
         setAddress(draft.address);
         setContact(draft.contact);
      }
      setDraftRestored(true);
   }, [draftRestored]);

   const handleSignUp = useCallback(async () => {
      Keyboard.dismiss();
      setError(null);

      // Basic validation
      if (!email.trim() || !password.trim() || !confirmPassword.trim() || !address.trim() || !contact.trim()) {
         setError('Please fill in all fields');
         return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
         setError('Please enter a valid email address');
         return;
      }

      // Validate password match
      if (password !== confirmPassword) {
         setError('Passwords do not match');
         return;
      }

      const passwordError = validateRegistrationPassword(password);
      if (passwordError) {
         setError(passwordError);
         return;
      }

      const contactError = validateIndianContact(contact);
      if (contactError) {
         setError(contactError);
         return;
      }

      setIsLoading(true);

      try {
         if (isAuthenticated && requiresOnboarding) {
            const progress = getSignupWizardProgress();
            const wizardRoute = resolveSignupWizardRoute(progress, {
               isAuthenticated,
               requiresOnboarding,
            });
            router.replace(signupWizardRouteToHref(wizardRoute) as Href);
            return;
         }

         const trimmedEmail = email.trim();
         const trimmedAddress = address.trim();
         const trimmedContact = contact.trim();

         await signup({
            email: trimmedEmail,
            password,
            confirmPassword,
            address: trimmedAddress,
            contact: trimmedContact,
         });

         await persistSignupWizardProgress({
            step: 'verify_otp',
            email: trimmedEmail,
            signupDraft: {
               email: trimmedEmail,
               address: trimmedAddress,
               contact: trimmedContact,
            },
         });

         router.push({
            pathname: '/verify-otp',
            params: { email: trimmedEmail, autoResendOtp: 'false' },
         });
      } catch (err) {
         // Handle API errors
         if (err instanceof ApiError) {
            if (err.status === 400) {
               const errorData = err.data as { message?: string } | undefined;
               setError(errorData?.message || 'Invalid signup data. Please check your information.');
            } else if (err.status === 409) {
               setError('An account with this email already exists');
            } else {
               const errorData = err.data as { message?: string } | undefined;
               setError(errorData?.message || 'Signup failed. Please try again.');
            }
         } else {
            const errorMessage =
               err instanceof Error ? err.message : 'Unknown error';
            console.error('[SignUp] Non-API error:', errorMessage);

            // Provide helpful error message for network issues
            let userMessage = 'Network error. Please check your connection and try again.';
            if (errorMessage.includes('Network request failed')) {
               userMessage = 'Cannot connect to server. If testing on a physical device, set EXPO_PUBLIC_AUTH_API_URL to your computer\'s IP address (e.g., http://192.168.1.100:8080)';
            }

            setError(userMessage);
         }
      } finally {
         setIsLoading(false);
      }
   }, [email, password, confirmPassword, address, contact, isAuthenticated, requiresOnboarding]);

   const handleNavigateToSignIn = useCallback(() => {
      Keyboard.dismiss();
      router.push('/signin');
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
                     <Text style={styles.title}>Create Account</Text>
                     <Text style={styles.subtitle}>
                        Sign up to get started with AudioBook
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
                        testID="signup-email-input"
                     />

                     <TextInput
                        label="Password"
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Enter your password"
                        secureTextEntry={true}
                        autoCapitalize="none"
                        icon="lock-closed-outline"
                        testID="signup-password-input"
                     />

                     <TextInput
                        label="Confirm Password"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Confirm your password"
                        secureTextEntry={true}
                        autoCapitalize="none"
                        icon="lock-closed-outline"
                        testID="signup-confirm-password-input"
                     />

                     <TextInput
                        label="Address"
                        value={address}
                        onChangeText={setAddress}
                        placeholder="Enter your address"
                        autoCapitalize="words"
                        icon="location-outline"
                        testID="signup-address-input"
                     />

                     <TextInput
                        label="Contact"
                        value={contact}
                        onChangeText={setContact}
                        placeholder="Enter your mobile number"
                        keyboardType="phone-pad"
                        icon="call-outline"
                        testID="signup-contact-input"
                     />

                     {/* Error Message */}
                     {error && (
                        <View style={styles.errorContainer}>
                           <Text style={styles.errorText}>{error}</Text>
                        </View>
                     )}

                     {/* Sign Up Button */}
                     <SecondaryButton
                        title="Sign Up"
                        onPress={handleSignUp}
                        loading={isLoading}
                        disabled={isLoading}
                        style={styles.authButton}
                        testID="signup-button"
                     />

                     {/* Sign In Link */}
                     <View style={styles.signInLinkContainer}>
                        <Text style={styles.signInLinkText}>
                           Already have an account?{' '}
                        </Text>
                        <TouchableOpacity
                           onPress={handleNavigateToSignIn}
                           activeOpacity={0.7}
                        >
                           <Text style={styles.signInLink}>Sign In</Text>
                        </TouchableOpacity>
                     </View>
                  </View>
               </ScrollView>
            </KeyboardAvoidingView>
         </SafeAreaView>
      </>
   );
}

