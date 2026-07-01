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
import { ApiError } from '@/services/api';
import {
   confirmDeviceRemoval,
   resendDeviceRemovalOtp,
} from '@/services/devices';
import { useDeviceLimitStore } from '@/store/deviceLimit';
import { getAuthApiErrorMessage } from '@/utils/authApiErrors';

/** Minimum seconds before the user can resend the device removal OTP */
const RESEND_OTP_COOLDOWN_SECONDS = 30;

/**
 * OTP verification screen for removing a registered device when device limit is exceeded.
 */
export default function VerifyDeviceRemovalOtpScreen() {
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
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
   },
   backButton: {
      alignSelf: 'flex-start',
      marginBottom: spacing.lg,
   },
   backButtonText: {
      color: t.colors.primary[400],
      fontSize: typography.fontSize.base,
   },
   header: {
      marginBottom: spacing.xl,
      alignItems: 'center',
   },
   title: {
      fontSize: typography.fontSize['3xl'],
      fontWeight: '700',
      color: t.colors.text.dark,
      marginBottom: spacing.sm,
      textAlign: 'center',
      ...Platform.select({
         ios: { fontFamily: 'System' },
         android: { fontFamily: 'sans-serif-medium' },
      }),
   },
   subtitle: {
      fontSize: typography.fontSize.base,
      color: t.colors.text.secondaryDark,
      textAlign: 'center',
      lineHeight: typography.fontSize.base * typography.lineHeight.normal,
   },
   otpContainer: {
      marginBottom: spacing.lg,
   },
   errorContainer: {
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      borderRadius: 8,
      padding: spacing.md,
      marginBottom: spacing.md,
   },
   errorText: {
      color: t.colors.error,
      fontSize: typography.fontSize.sm,
      textAlign: 'center',
   },
   noteContainer: {
      marginBottom: spacing.lg,
      alignItems: 'center',
   },
   noteText: {
      fontSize: typography.fontSize.sm,
      color: t.colors.text.secondaryDark,
   },
   resendContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
   },
   resendLabel: {
      fontSize: typography.fontSize.sm,
      color: t.colors.text.secondaryDark,
   },
   resendCountdown: {
      fontSize: typography.fontSize.sm,
      color: t.colors.text.secondaryDark,
   },
   resendButton: {
      fontSize: typography.fontSize.sm,
      color: t.colors.primary[400],
      fontWeight: '600',
   },
   loadingContainer: {
      marginTop: spacing.xl,
      alignItems: 'center',
      gap: spacing.sm,
   },
   loadingText: {
      fontSize: typography.fontSize.sm,
      color: t.colors.text.secondaryDark,
   },
      })
   );

   const params = useLocalSearchParams<{
      email: string;
      recordId: string;
      deviceName?: string;
   }>();

   const email = params.email ?? '';
   const recordId = params.recordId ?? '';
   const deviceName = params.deviceName ?? 'this device';

   const clearContext = useDeviceLimitStore((state) => state.clearContext);

   const [isVerifying, setIsVerifying] = useState(false);
   const [isResending, setIsResending] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [resendCountdown, setResendCountdown] = useState(0);
   const [otpKey, setOtpKey] = useState(0);
   const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

   const startCountdown = useCallback(() => {
      setResendCountdown(RESEND_OTP_COOLDOWN_SECONDS);
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

   useEffect(() => {
      startCountdown();

      return () => {
         if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
         }
      };
   }, [startCountdown]);

   useEffect(() => {
      if (!email || !recordId) {
         router.replace('/manage-devices');
      }
   }, [email, recordId]);

   const handleOtpComplete = useCallback(
      async (completeOtp: string) => {
         setError(null);
         setIsVerifying(true);

         try {
            await confirmDeviceRemoval({
               recordId,
               email,
               otp: completeOtp,
            });

            clearContext();
            router.replace('/signin');
         } catch (err) {
            if (err instanceof ApiError) {
               setError(
                  getAuthApiErrorMessage(err.data) ??
                     'Invalid OTP. Please try again.'
               );
            } else {
               const errorMessage =
                  err instanceof Error ? err.message : 'Unknown error';
               let userMessage = 'Network error. Please check your connection and try again.';
               if (errorMessage.includes('Network request failed')) {
                  userMessage =
                     'Cannot connect to server. If testing on a physical device, set EXPO_PUBLIC_AUTH_API_URL to your computer\'s IP address (e.g., http://192.168.1.100:8080)';
               }
               setError(userMessage);
            }
            setOtpKey((prev) => prev + 1);
         } finally {
            setIsVerifying(false);
         }
      },
      [recordId, email, clearContext]
   );

   const handleResendOtp = useCallback(async () => {
      if (resendCountdown > 0) {
         return;
      }

      setError(null);
      setIsResending(true);

      try {
         await resendDeviceRemovalOtp({ email, deviceId: recordId });
         startCountdown();
      } catch (err) {
         if (err instanceof ApiError) {
            setError(
               getAuthApiErrorMessage(err.data) ??
                  'Failed to resend OTP. Please try again.'
            );
         } else {
            setError('Failed to resend OTP. Please try again.');
         }
      } finally {
         setIsResending(false);
      }
   }, [resendCountdown, startCountdown, email, recordId]);

   const handleBackPress = useCallback(() => {
      router.back();
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
                  <TouchableOpacity
                     onPress={handleBackPress}
                     style={styles.backButton}
                     accessibilityRole="button"
                     accessibilityLabel="Go back"
                  >
                     <Text style={styles.backButtonText}>Back</Text>
                  </TouchableOpacity>

                  <View style={styles.header}>
                     <Text style={styles.title}>Verify removal</Text>
                     <Text style={styles.subtitle}>
                        Enter the OTP sent to {email} to remove {deviceName}
                     </Text>
                  </View>

                  <View style={styles.otpContainer}>
                     <OtpInput
                        key={otpKey}
                        onComplete={handleOtpComplete}
                        disabled={isVerifying}
                        testID="device-removal-otp-input"
                     />
                  </View>

                  {error && (
                     <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                     </View>
                  )}

                  <View style={styles.noteContainer}>
                     <Text style={styles.noteText}>The OTP will expire in 10 minutes</Text>
                  </View>

                  <View style={styles.resendContainer}>
                     <Text style={styles.resendLabel}>Didn&apos;t receive the OTP? </Text>
                     {resendCountdown > 0 ? (
                        <Text style={styles.resendCountdown}>
                           Resend OTP in {resendCountdown}s
                        </Text>
                     ) : (
                        <TouchableOpacity
                           onPress={() => void handleResendOtp()}
                           disabled={isResending}
                           activeOpacity={0.7}
                           testID="resend-device-removal-otp-button"
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

                  {isVerifying && (
                     <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.app.red} />
                        <Text style={styles.loadingText}>Removing device...</Text>
                     </View>
                  )}
               </ScrollView>
            </KeyboardAvoidingView>
         </SafeAreaView>
      </>
   );
}

