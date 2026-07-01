import React, { useCallback, useState } from 'react';
import {
   StyleSheet,
   ScrollView,
   Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import * as Application from 'expo-application';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsMenuRow } from '@/components/settings/SettingsMenuRow';
import { spacing } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';

export default function SettingsScreen() {
   const { colors } = useTheme();
   const styles = useThemedStyles((t) =>
      StyleSheet.create({
   container: {
      flex: 1,
      backgroundColor: t.colors.background.screen,
   },
   scrollView: {
      flex: 1,
   },
   scrollContent: {},
      })
   );

   const insets = useSafeAreaInsets();
   const [carModeEnabled, setCarModeEnabled] = useState(false);
   const appVersion = Application.nativeApplicationVersion ?? '1.0.0';

   const handleBackPress = useCallback(() => {
      router.back();
   }, []);

   const handleAccountPress = useCallback(() => {
      router.push('/account');
   }, []);

   return (
      <>
         <Stack.Screen
            options={{
               headerShown: false,
               contentStyle: { backgroundColor: colors.background.screen },
            }}
         />
         <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <ScreenHeader
               headerIcon="settings"
               onBack={handleBackPress}
               titleSize="large"
            />
            <ScrollView
               style={styles.scrollView}
               contentContainerStyle={[
                  styles.scrollContent,
                  { paddingBottom: insets.bottom + spacing.xl },
               ]}
               showsVerticalScrollIndicator={false}
            >
               <SettingsSection title="Playback">
                  <SettingsMenuRow
                     title="Playback Settings"
                     subtitle="Sleep timer, skip intervals, speed"
                     icon="play-circle-outline"
                     iconBg={colors.iconBackgrounds.brown}
                     iconColor={colors.iconForegrounds.brown}
                     onPress={() => router.push('/playback-settings')}
                  />
                  <SettingsMenuRow
                     title="Downloads"
                     subtitle="Download quality, storage location"
                     icon="download-outline"
                     iconBg={colors.iconBackgrounds.green}
                     iconColor={colors.iconForegrounds.green}
                     onPress={() => router.push('/settings/downloads')}
                  />
                  <SettingsMenuRow
                     title="Audio Quality"
                     subtitle="Streaming & download quality"
                     icon="pulse-outline"
                     iconBg={colors.iconBackgrounds.pink}
                     iconColor={colors.iconForegrounds.pink}
                     onPress={() => router.push('/audio-quality')}
                  />
                  <SettingsMenuRow
                     title="Car Mode"
                     subtitle="Driving settings and shortcuts"
                     icon="car-outline"
                     iconBg={colors.iconBackgrounds.purple}
                     iconColor={colors.iconForegrounds.purple}
                     showChevron={false}
                     isLast
                     trailing={
                        <Switch
                           value={carModeEnabled}
                           onValueChange={setCarModeEnabled}
                           trackColor={{
                              false: colors.border.medium,
                              true: colors.primary[300],
                           }}
                           thumbColor={colors.background.screen}
                        />
                     }
                  />
               </SettingsSection>

               <SettingsSection title="Personalization">
                  <SettingsMenuRow
                     title="Content Preferences"
                     subtitle="Genres, themes & topics you love"
                     icon="heart-outline"
                     iconBg={colors.iconBackgrounds.pink}
                     iconColor={colors.iconForegrounds.pink}
                     onPress={() => router.push('/content-preferences')}
                  />
                  <SettingsMenuRow
                     title="Recommendations"
                     subtitle="Manage your recommendation settings"
                     icon="sparkles-outline"
                     iconBg={colors.iconBackgrounds.yellow}
                     iconColor={colors.iconForegrounds.yellow}
                  />
                  <SettingsMenuRow
                     title="Notifications"
                     subtitle="Manage push notifications"
                     icon="notifications-outline"
                     iconBg={colors.iconBackgrounds.green}
                     iconColor={colors.iconForegrounds.green}
                     isLast
                  />
               </SettingsSection>

               <SettingsSection title="Account & App">
                  <SettingsMenuRow
                     title="Privacy & Security"
                     subtitle="Manage privacy and security settings"
                     icon="shield-checkmark-outline"
                     iconBg={colors.iconBackgrounds.blue}
                     iconColor={colors.iconForegrounds.blue}
                     onPress={handleAccountPress}
                  />
                  <SettingsMenuRow
                     title="Payment & Billing"
                     subtitle="Manage your subscription and payments"
                     icon="card-outline"
                     iconBg={colors.iconBackgrounds.orange}
                     iconColor={colors.iconForegrounds.orange}
                     onPress={() => router.push('/subscription-plans')}
                  />
                  <SettingsMenuRow
                     title="About"
                     subtitle={`App version, terms & policies · v${appVersion}`}
                     icon="information-circle-outline"
                     iconBg={colors.iconBackgrounds.purple}
                     iconColor={colors.iconForegrounds.purple}
                     isLast
                  />
               </SettingsSection>
            </ScrollView>
         </SafeAreaView>
      </>
   );
}

