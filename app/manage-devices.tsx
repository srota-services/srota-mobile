import React, { useCallback, useEffect, useState } from 'react';
import {
   View,
   Text,
   StyleSheet,
   ScrollView,
   TouchableOpacity,
   Platform,
   ActivityIndicator,
   Modal,
   KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextInput } from '@/components/TextInput';
import { spacing, typography, borderRadius } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { getAuthDevices, requestDeviceRemovalOtp } from '@/services/devices';
import { useDeviceLimitStore } from '@/store/deviceLimit';
import type { RegisteredDevice } from '@/utils/authApiErrors';
import { getApiErrorMessage } from '@/utils/getApiErrorMessage';
import { formatAccountDate } from '@/utils/format';
import { store } from '@/store';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getPlatformIcon(platform: string): keyof typeof Ionicons.glyphMap {
   const normalized = platform.toLowerCase();
   if (normalized.includes('ios') || normalized.includes('iphone') || normalized.includes('ipad')) {
      return 'phone-portrait-outline';
   }
   if (normalized.includes('android')) {
      return 'logo-android';
   }
   if (normalized.includes('web')) {
      return 'globe-outline';
   }
   return 'hardware-chip-outline';
}

/**
 * Device management screen shown when the subscription device limit is reached during login.
 */
export default function ManageDevicesScreen() {
   const { colors } = useTheme();
   const styles = useThemedStyles((t) =>
      StyleSheet.create({
   container: {
      flex: 1,
      backgroundColor: t.colors.background.dark,
   },
   scrollView: {
      flex: 1,
   },
   scrollContent: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xl,
   },
   description: {
      fontSize: typography.fontSize.base,
      color: t.colors.text.secondaryDark,
      lineHeight: typography.fontSize.base * typography.lineHeight.normal,
      marginBottom: spacing.sm,
   },
   limitHint: {
      fontSize: typography.fontSize.sm,
      color: t.colors.text.secondaryDark,
      marginBottom: spacing.lg,
   },
   errorContainer: {
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
   },
   errorText: {
      color: t.colors.error,
      fontSize: typography.fontSize.sm,
   },
   loadingContainer: {
      paddingVertical: spacing.xxl,
      alignItems: 'center',
   },
   emptyContainer: {
      alignItems: 'center',
      paddingVertical: spacing.xxl,
      gap: spacing.md,
   },
   emptyText: {
      color: t.colors.text.secondaryDark,
      fontSize: typography.fontSize.base,
      textAlign: 'center',
   },
   deviceList: {
      gap: spacing.sm,
   },
   deviceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.background.darkGrayLight,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      gap: spacing.md,
   },
   deviceIconWrap: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.md,
      backgroundColor: t.colors.background.darkGray,
      alignItems: 'center',
      justifyContent: 'center',
   },
   deviceInfo: {
      flex: 1,
      gap: 2,
   },
   deviceName: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semiBold as '600',
      color: t.colors.text.dark,
   },
   deviceMeta: {
      fontSize: typography.fontSize.sm,
      color: t.colors.text.secondaryDark,
   },
   removeButton: {
      minWidth: 72,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
   },
   removeButtonText: {
      color: t.colors.app.red,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.semiBold as '600',
   },
   modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
   },
   modalContent: {
      backgroundColor: t.colors.background.darkGrayLight,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      gap: spacing.md,
   },
   modalTitle: {
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.semiBold as '600',
      color: t.colors.text.dark,
      textAlign: 'center',
   },
   modalDescription: {
      fontSize: typography.fontSize.sm,
      color: t.colors.text.secondaryDark,
      lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
      textAlign: 'center',
   },
   modalActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
   },
   modalCancelButton: {
      flex: 1,
      paddingVertical: spacing.md,
      alignItems: 'center',
      borderRadius: borderRadius.md,
      backgroundColor: t.colors.background.input,
   },
   modalCancelText: {
      color: t.colors.text.dark,
      fontSize: typography.fontSize.base,
   },
   modalConfirmButton: {
      flex: 1,
      paddingVertical: spacing.md,
      alignItems: 'center',
      borderRadius: borderRadius.md,
      backgroundColor: t.colors.app.red,
   },
   modalConfirmText: {
      color: t.colors.text.dark,
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semiBold as '600',
   },
      })
   );

   const limitMessage = useDeviceLimitStore((state) => state.message);
   const maxDevices = useDeviceLimitStore((state) => state.maxDevices);
   const storedDevices = useDeviceLimitStore((state) => state.registeredDevices);
   const setRegisteredDevices = useDeviceLimitStore((state) => state.setRegisteredDevices);
   const clearContext = useDeviceLimitStore((state) => state.clearContext);

   const [devices, setDevices] = useState<RegisteredDevice[]>(storedDevices);
   const [isLoadingFallback, setIsLoadingFallback] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [selectedDevice, setSelectedDevice] = useState<RegisteredDevice | null>(null);
   const [email, setEmail] = useState('');
   const [emailError, setEmailError] = useState<string | null>(null);
   const [isRequestingOtp, setIsRequestingOtp] = useState(false);

   useEffect(() => {
      if (storedDevices.length > 0) {
         setDevices(storedDevices);
         return;
      }

      const isAuthenticated = store.getState().auth?.isAuthenticated;
      if (!isAuthenticated) {
         return;
      }

      setIsLoadingFallback(true);
      void getAuthDevices()
         .then((list) => {
            setDevices(list);
            setRegisteredDevices(list);
         })
         .catch((err) => {
            setError(getApiErrorMessage(err, 'Failed to load devices. Please try again.'));
         })
         .finally(() => {
            setIsLoadingFallback(false);
         });
   }, [storedDevices, setRegisteredDevices]);

   const handleBackPress = useCallback(() => {
      clearContext();
      if (store.getState().auth?.isAuthenticated) {
         router.back();
         return;
      }
      router.replace('/signin');
   }, [clearContext]);

   const handleRemovePress = useCallback((device: RegisteredDevice) => {
      setSelectedDevice(device);
      setEmail('');
      setEmailError(null);
      setError(null);
   }, []);

   const handleCloseEmailModal = useCallback(() => {
      if (isRequestingOtp) {
         return;
      }
      setSelectedDevice(null);
      setEmail('');
      setEmailError(null);
   }, [isRequestingOtp]);

   const handleSubmitEmail = useCallback(async () => {
      if (!selectedDevice) {
         return;
      }

      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
         setEmailError('Please enter your email address');
         return;
      }
      if (!EMAIL_REGEX.test(trimmedEmail)) {
         setEmailError('Please enter a valid email address');
         return;
      }

      setEmailError(null);
      setIsRequestingOtp(true);

      try {
         await requestDeviceRemovalOtp({
            email: trimmedEmail,
            deviceId: selectedDevice.id,
         });

         router.push({
            pathname: '/verify-device-removal-otp',
            params: {
               email: trimmedEmail,
               recordId: selectedDevice.id,
               deviceName: selectedDevice.deviceName,
            },
         });
         setSelectedDevice(null);
         setEmail('');
      } catch (err) {
         setEmailError(
            getApiErrorMessage(err, 'Failed to send OTP. Please try again.')
         );
      } finally {
         setIsRequestingOtp(false);
      }
   }, [selectedDevice, email]);

   const isLoading = isLoadingFallback && devices.length === 0;

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
            <ScreenHeader
               headerIcon="manage-devices"
               onBack={handleBackPress}
               titleSize="large"
               tone="onDark"
            />

            <ScrollView
               style={styles.scrollView}
               contentContainerStyle={styles.scrollContent}
               showsVerticalScrollIndicator={false}
            >
               <Text style={styles.description}>
                  {limitMessage ??
                     'Your subscription plan limits how many devices can access your account. Remove a device below, then sign in again.'}
               </Text>

               {maxDevices != null && maxDevices > 0 && (
                  <Text style={styles.limitHint}>
                     Your plan allows up to {maxDevices}{' '}
                     {maxDevices === 1 ? 'device' : 'devices'}.
                  </Text>
               )}

               {error && (
                  <View style={styles.errorContainer}>
                     <Text style={styles.errorText}>{error}</Text>
                  </View>
               )}

               {isLoading ? (
                  <View style={styles.loadingContainer}>
                     <ActivityIndicator size="large" color={colors.app.red} />
                  </View>
               ) : devices.length === 0 ? (
                  <View style={styles.emptyContainer}>
                     <Ionicons
                        name="phone-portrait-outline"
                        size={48}
                        color={colors.text.secondaryDark}
                     />
                     <Text style={styles.emptyText}>No registered devices found.</Text>
                  </View>
               ) : (
                  <View style={styles.deviceList}>
                     {devices.map((device) => (
                        <View key={device.id} style={styles.deviceCard}>
                           <View style={styles.deviceIconWrap}>
                              <Ionicons
                                 name={getPlatformIcon(device.platform)}
                                 size={28}
                                 color={colors.text.dark}
                              />
                           </View>

                           <View style={styles.deviceInfo}>
                              <Text style={styles.deviceName}>{device.deviceName}</Text>
                              <Text style={styles.deviceMeta}>
                                 {device.platform.charAt(0).toUpperCase() +
                                    device.platform.slice(1)}
                              </Text>
                              <Text style={styles.deviceMeta}>
                                 Last active {formatAccountDate(device.lastSeenAt)}
                              </Text>
                           </View>

                           <TouchableOpacity
                              onPress={() => handleRemovePress(device)}
                              style={styles.removeButton}
                              accessibilityRole="button"
                              accessibilityLabel={`Remove ${device.deviceName}`}
                           >
                              <Text style={styles.removeButtonText}>Remove</Text>
                           </TouchableOpacity>
                        </View>
                     ))}
                  </View>
               )}
            </ScrollView>
         </SafeAreaView>

         <Modal
            visible={selectedDevice !== null}
            transparent
            animationType="fade"
            onRequestClose={handleCloseEmailModal}
         >
            <KeyboardAvoidingView
               style={styles.modalOverlay}
               behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
               <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Confirm your email</Text>
                  <Text style={styles.modalDescription}>
                     Enter the email address used on{' '}
                     {selectedDevice ? `"${selectedDevice.deviceName}"` : 'the other device'} to
                     receive a verification code.
                  </Text>

                  <TextInput
                     value={email}
                     onChangeText={(text) => {
                        setEmail(text);
                        setEmailError(null);
                     }}
                     placeholder="Email address"
                     label="Email"
                     keyboardType="email-address"
                     autoCapitalize="none"
                     autoCorrect={false}
                     icon="mail-outline"
                     editable={!isRequestingOtp}
                     error={emailError ?? undefined}
                     testID="device-removal-email-input"
                  />

                  <View style={styles.modalActions}>
                     <TouchableOpacity
                        onPress={handleCloseEmailModal}
                        style={styles.modalCancelButton}
                        disabled={isRequestingOtp}
                     >
                        <Text style={styles.modalCancelText}>Cancel</Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                        onPress={() => void handleSubmitEmail()}
                        style={styles.modalConfirmButton}
                        disabled={isRequestingOtp}
                     >
                        {isRequestingOtp ? (
                           <ActivityIndicator size="small" color={colors.text.dark} />
                        ) : (
                           <Text style={styles.modalConfirmText}>Send OTP</Text>
                        )}
                     </TouchableOpacity>
                  </View>
               </View>
            </KeyboardAvoidingView>
         </Modal>
      </>
   );
}

