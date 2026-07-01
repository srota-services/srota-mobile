import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
   View,
   Text,
   StyleSheet,
   ScrollView,
   TouchableOpacity,
   Platform,
   KeyboardAvoidingView,
   ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { OtpInput } from '@/components/OtpInput';
import { spacing, typography } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import {
   verifyEmailUpdateOtp,
   requestEmailUpdateOtp,
} from '@/services/auth';
import { ApiError } from '@/services/api';

/**
 * Email update OTP verification screen
 * Displays 6-digit OTP input with auto-submit and resend functionality
 */
export default function VerifyEmailOtpScreen() {
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
   otpContainer: {
      marginBottom: spacing.xl,
      alignItems: 'center',
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
   noteContainer: {
      marginBottom: spacing.lg,
      alignItems: 'center',
   },
   noteText: {
      fontSize: typography.fontSize.sm,
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
   resendContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.xl,
   },
   resendLabel: {
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
   resendCountdown: {
      fontSize: typography.fontSize.base,
      color: t.colors.text.secondaryDark,
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
   resendButton: {
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
   loadingContainer: {
      alignItems: 'center',
      marginTop: spacing.lg,
   },
   loadingText: {
      fontSize: typography.fontSize.base,
      color: t.colors.text.secondaryDark,
      marginTop: spacing.md,
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
      })
   );

   const params = useLocalSearchParams<{ email: string }>();
   const email = params.email || '';

   const [isVerifying, setIsVerifying] = useState(false);
   const [isResending, setIsResending] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [resendCountdown, setResendCountdown] = useState(0);
   const [otpKey, setOtpKey] = useState(0); // Key to reset OTP input
   const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

   /**
    * Start countdown timer for resend OTP button
    */
   const startCountdown = useCallback(() => {
      setResendCountdown(30);
      if (countdownIntervalRef.current) {
         clearInterval(countdownIntervalRef.current);
      }
      countdownIntervalRef.current = setInterval(() => {
         setResendCountdown((prev) => {
            if (prev <= 1) {
               if (countdownIntervalRef.current) {
                  clearInterval(countdownIntervalRef.current);
                  countdownIntervalRef.current = null;
               }
               return 0;
            }
            return prev - 1;
         });
      }, 1000);
   }, []);

   /**
    * Cleanup countdown on unmount
    */
   useEffect(() => {
      // Start countdown when component mounts
      startCountdown();

      return () => {
         if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
         }
      };
   }, [startCountdown]);

   /**
    * Handle OTP completion (auto-submit when all digits entered)
    */
   const handleOtpComplete = useCallback(
      async (completeOtp: string) => {
         if (!email) {
            setError('Email is required');
            return;
         }

         setError(null);
         setIsVerifying(true);

         try {
            // Verify email update OTP
            await verifyEmailUpdateOtp({ otp: completeOtp });

            // Redirect to email update screen
            router.replace('/change-email');
         } catch (err) {
            // Handle API errors
            if (err instanceof ApiError) {
               if (err.status === 400) {
                  const errorData = err.data as { message?: string } | undefined;
                  setError(errorData?.message || 'Invalid OTP. Please try again.');
               } else if (err.status === 401) {
                  setError('OTP verification failed. Please check your OTP and try again.');
               } else {
                  const errorData = err.data as { message?: string } | undefined;
                  setError(errorData?.message || 'OTP verification failed. Please try again.');
               }
            } else {
               const errorMessage =
                  err instanceof Error ? err.message : 'Unknown error';
               console.error('[VerifyEmailOtp] Non-API error:', errorMessage);

               // Provide helpful error message for network issues
               let userMessage = 'Network error. Please check your connection and try again.';
               if (errorMessage.includes('Network request failed')) {
                  userMessage =
                     'Cannot connect to server. If testing on a physical device, set EXPO_PUBLIC_AUTH_API_URL to your computer\'s IP address (e.g., http://192.168.1.100:8080)';
               }

               setError(userMessage);
            }
            // Reset OTP input on error
            setOtpKey((prev) => prev + 1);
         } finally {
            setIsVerifying(false);
         }
      },
      [email]
   );

   /**
    * Handle resend OTP
    */
   const handleResendOtp = useCallback(async () => {
      if (resendCountdown > 0 || !email) {
         return;
      }

      setError(null);
      setIsResending(true);

      try {
         // Resend email update OTP
         await requestEmailUpdateOtp({ email: email.trim() });

         // Restart countdown
         startCountdown();
      } catch (err) {
         // Handle API errors
         if (err instanceof ApiError) {
            if (err.status === 400) {
               const errorData = err.data as { message?: string } | undefined;
               setError(errorData?.message || 'Failed to resend OTP. Please try again.');
            } else {
               const errorData = err.data as { message?: string } | undefined;
               setError(errorData?.message || 'Failed to resend OTP. Please try again.');
            }
         } else {
            const errorMessage =
               err instanceof Error ? err.message : 'Unknown error';
            console.error('[VerifyEmailOtp] Resend OTP error:', errorMessage);

            // Provide helpful error message for network issues
            let userMessage = 'Network error. Please check your connection and try again.';
            if (errorMessage.includes('Network request failed')) {
               userMessage =
                  'Cannot connect to server. If testing on a physical device, set EXPO_PUBLIC_AUTH_API_URL to your computer\'s IP address (e.g., http://192.168.1.100:8080)';
            }

            setError(userMessage);
         }
      } finally {
         setIsResending(false);
      }
   }, [email, resendCountdown, startCountdown]);

   // Redirect to account if email is missing
   useEffect(() => {
      if (!email) {
         router.replace('/account');
      }
   }, [email]);

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
                     <Text style={styles.title}>OTP Verification</Text>
                     <Text style={styles.subtitle}>
                        OTP sent successfully to {email}
                     </Text>
                  </View>

                  {/* OTP Input */}
                  <View style={styles.otpContainer}>
                     <OtpInput
                        key={otpKey}
                        onComplete={handleOtpComplete}
                        disabled={isVerifying}
                        testID="otp-input"
                     />
                  </View>

                  {/* Error Message */}
                  {error && (
                     <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                     </View>
                  )}

                  {/* Expiration Note */}
                  <View style={styles.noteContainer}>
                     <Text style={styles.noteText}>
                        The OTP will expire in 10 minutes
                     </Text>
                  </View>

                  {/* Resend OTP Button */}
                  <View style={styles.resendContainer}>
                     <Text style={styles.resendLabel}>{"Didn't receive the OTP? "}</Text>
                     {resendCountdown > 0 ? (
                        <Text style={styles.resendCountdown}>
                           Resend OTP in {resendCountdown}s
                        </Text>
                     ) : (
                        <TouchableOpacity
                           onPress={handleResendOtp}
                           disabled={isResending}
                           activeOpacity={0.7}
                           testID="resend-otp-button"
                        >
                           {isResending ? (
                              <ActivityIndicator
                                 size="small"
                                 color={colors.primary[400]}
                              />
                           ) : (
                              <Text style={styles.resendButton}>Resend OTP</Text>
                           )}
                        </TouchableOpacity>
                     )}
                  </View>

                  {/* Loading Indicator */}
                  {isVerifying && (
                     <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.app.red} />
                        <Text style={styles.loadingText}>Verifying OTP...</Text>
                     </View>
                  )}
               </ScrollView>
            </KeyboardAvoidingView>
         </SafeAreaView>
      </>
   );
}

