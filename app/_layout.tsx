import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, router, useSegments, type Href } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/utils/queryClient';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { store, persistor, initializeApp } from '@/store';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import SplashScreen from '@/components/SplashScreen';
import { AudioPlayer } from '@/components/AudioPlayer';
import { AudioPlaybackProvider } from '@/contexts/AudioPlaybackContext';
import { configureGoogleSignIn } from '@/services/auth';
import { useTrackPlayerSetup } from '@/hooks/useTrackPlayerSetup';
import * as Linking from 'expo-linking';
import { usePlaybackNotificationLinking } from '@/hooks/usePlaybackNotificationLinking';
import { usePlaybackReturnPathTracker } from '@/hooks/usePlaybackReturnPathTracker';
import { useDeviceLocationOnAppLoad } from '@/hooks/useDeviceLocationOnAppLoad';
import { useUserLocationSync } from '@/hooks/useUserLocationSync';
import { isTrackPlayerNotificationUrl } from '@/utils/playbackNotificationNavigation';
import { resolvePersistedPlaybackRoute } from '@/utils/playbackReturnPathStorage';
import {
   clearSignupWizardProgress,
   getSignupWizardProgress,
   resolveSignupWizardRoute,
   signupWizardRouteToHref,
} from '@/utils/signupWizardStorage';
import { hydrateOnboardingStoreFromProgress } from '@/store/onboarding';
import { ToastProvider } from '@/contexts/ToastContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { Toast } from '@/components/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DomainEventsSync } from '@/components/DomainEventsSync';
import { EnvironmentBadge } from '@/components/EnvironmentBadge';
import { preloadAppAssets } from '@/utils/preloadAppAssets';
import '../global.css';

const styles = StyleSheet.create({
   splashOverlay: {
      ...StyleSheet.absoluteFillObject,
   },
});

// Initialize Reactotron in development mode
if (__DEV__) {
   // eslint-disable-next-line @typescript-eslint/no-require-imports
   require('../config/ReactotronConfig');
}

function ThemedAppShell({ children }: { children: React.ReactNode }) {
   const { colors, isDark } = useTheme();

   return (
      <View style={{ flex: 1, backgroundColor: colors.background.screen }}>
         <StatusBar style={isDark ? 'light' : 'dark'} />
         {children}
      </View>
   );
}

/**
 * Inner layout component that handles auth-based routing
 */
function InnerLayout() {
   useTrackPlayerSetup();
   const { colors } = useTheme();
   const segments = useSegments();
   const isAuthenticated = useSelector(
      (state: RootState) => state.auth.isAuthenticated
   );
   const isInitialized = useSelector(
      (state: RootState) => state.auth.isInitialized
   );
   const requiresOnboarding = useSelector(
      (state: RootState) => state.auth.requiresOnboarding
   );
   const profileFetched = useSelector(
      (state: RootState) => state.auth.profileFetched
   );
   const [isAppReady, setIsAppReady] = useState(false);
   const [showSplash, setShowSplash] = useState(true);
   const [isInitialRouteSet, setIsInitialRouteSet] = useState(false);
   const splashStartTime = useRef<number>(Date.now());

   const stackReady = isAppReady && isInitialized;
   const initialStackRoute = !isAuthenticated
      ? 'signin'
      : requiresOnboarding
         ? 'onboarding'
         : '(tabs)';

   const screenBackground = { backgroundColor: colors.background.screen };

   usePlaybackReturnPathTracker();
   usePlaybackNotificationLinking(isAppReady && isInitialized && !showSplash);
   useDeviceLocationOnAppLoad(isAppReady);
   useUserLocationSync(isAppReady);

   useEffect(() => {
      const init = async () => {
         configureGoogleSignIn();
         await Promise.all([initializeApp(), preloadAppAssets()]);
         setIsAppReady(true);
      };
      init();

      const fallbackTimeout = setTimeout(() => {
         setIsAppReady(true);
      }, 2000);

      return () => clearTimeout(fallbackTimeout);
   }, []);

   useEffect(() => {
      if (!stackReady || isInitialRouteSet) {
         return;
      }

      void (async () => {
         const progress = getSignupWizardProgress();
         const routeContext = {
            isAuthenticated,
            requiresOnboarding,
         };

         if (isAuthenticated && !requiresOnboarding) {
            await clearSignupWizardProgress();
         }

         if (!isAuthenticated) {
            const wizardRoute = resolveSignupWizardRoute(progress, routeContext);
            router.replace(signupWizardRouteToHref(wizardRoute));
            setIsInitialRouteSet(true);
            return;
         }

         const initialUrl = await Linking.getInitialURL();
         if (isTrackPlayerNotificationUrl(initialUrl)) {
            const returnRoute = await resolvePersistedPlaybackRoute();
            if (returnRoute) {
               router.replace(returnRoute as Href);
               setIsInitialRouteSet(true);
               return;
            }
         }

         if (requiresOnboarding) {
            hydrateOnboardingStoreFromProgress();
            const wizardRoute = resolveSignupWizardRoute(progress, routeContext);
            router.replace(signupWizardRouteToHref(wizardRoute));
            setIsInitialRouteSet(true);
            return;
         }

         router.replace('/(tabs)');
         setIsInitialRouteSet(true);
      })();
   }, [stackReady, isAuthenticated, requiresOnboarding, isInitialRouteSet]);

   useEffect(() => {
      if (!stackReady || !isInitialRouteSet) {
         return;
      }

      const elapsed = Date.now() - splashStartTime.current;
      const minDisplayTime = 1000;
      const remainingTime = Math.max(0, minDisplayTime - elapsed);

      const timer = setTimeout(() => {
         setShowSplash(false);
      }, remainingTime);

      return () => clearTimeout(timer);
   }, [stackReady, isInitialRouteSet]);

   useEffect(() => {
      if (!stackReady || showSplash) {
         return;
      }

      const inOnboarding = String(segments[0]) === 'onboarding';
      const inAuthGroup =
         segments[0] === '(tabs)' ||
         segments[0] === 'details' ||
         segments[0] === 'search' ||
         segments[0] === 'library' ||
         segments[0] === 'playlists' ||
         String(segments[0]) === 'moods' ||
         segments[0] === 'account' ||
         String(segments[0]) === 'settings' ||
         segments[0] === 'playback-settings' ||
         segments[0] === 'audio-quality' ||
         segments[0] === 'content-preferences' ||
         segments[0] === 'subscription-plans' ||
         segments[0] === 'update-first-name' ||
         segments[0] === 'update-last-name' ||
         segments[0] === 'update-avatar' ||
         segments[0] === 'change-password' ||
         segments[0] === 'change-email' ||
         segments[0] === 'verify-password-otp' ||
         segments[0] === 'verify-email-otp' ||
         inOnboarding;

      const onAuthScreen =
         segments[0] === 'signin' ||
         segments[0] === 'signup' ||
         segments[0] === 'verify-otp';

      if (!isAuthenticated && inAuthGroup) {
         router.replace('/signin');
      } else if (isAuthenticated && requiresOnboarding && !inOnboarding) {
         hydrateOnboardingStoreFromProgress();
         const progress = getSignupWizardProgress();
         const wizardRoute = resolveSignupWizardRoute(progress, {
            isAuthenticated,
            requiresOnboarding,
         });
         router.replace(signupWizardRouteToHref(wizardRoute));
      } else if (isAuthenticated && !requiresOnboarding && (onAuthScreen || inOnboarding)) {
         if (onAuthScreen && !profileFetched) {
            return;
         }
         router.replace('/(tabs)');
      }
   }, [
      isAuthenticated,
      requiresOnboarding,
      profileFetched,
      isInitialized,
      stackReady,
      segments,
      showSplash,
   ]);

   if (!stackReady) {
      return <SplashScreen />;
   }

   return (
      <>
         <AudioPlaybackProvider>
            <Stack
               initialRouteName={initialStackRoute}
               screenOptions={{
                  headerShown: false,
                  contentStyle: screenBackground,
               }}
            >
            <Stack.Screen name="(tabs)" options={{ contentStyle: screenBackground }} />
            <Stack.Screen name="details/[id]" options={{ contentStyle: screenBackground }} />
            <Stack.Screen name="search" options={{ contentStyle: screenBackground }} />
            <Stack.Screen name="signin" options={{ contentStyle: screenBackground }} />
            <Stack.Screen name="signup" options={{ contentStyle: screenBackground }} />
            <Stack.Screen name="verify-otp" options={{ contentStyle: screenBackground }} />
            <Stack.Screen name="verify-password-otp" options={{ contentStyle: screenBackground }} />
            <Stack.Screen name="verify-email-otp" options={{ contentStyle: screenBackground }} />
            <Stack.Screen name="change-password" options={{ contentStyle: screenBackground }} />
            <Stack.Screen name="change-email" options={{ contentStyle: screenBackground }} />
            <Stack.Screen name="update-first-name" options={{ contentStyle: screenBackground }} />
            <Stack.Screen name="update-last-name" options={{ contentStyle: screenBackground }} />
            <Stack.Screen name="update-avatar" options={{ contentStyle: screenBackground }} />
            <Stack.Screen name="account" options={{ contentStyle: screenBackground }} />
            <Stack.Screen name="subscription-plans" options={{ contentStyle: screenBackground }} />
            <Stack.Screen name="manage-devices" options={{ contentStyle: screenBackground }} />
            <Stack.Screen name="verify-device-removal-otp" options={{ contentStyle: screenBackground }} />
            <Stack.Screen name="chapter-comments" options={{ contentStyle: screenBackground }} />
            <Stack.Screen name="publisher/[id]" options={{ contentStyle: screenBackground }} />
            <Stack.Screen name="playlists/[id]" options={{ contentStyle: screenBackground }} />
            <Stack.Screen
               name="library"
               options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                  contentStyle: screenBackground,
               }}
            />
            <Stack.Screen
               name="onboarding"
               options={{
                  contentStyle: screenBackground,
                  gestureEnabled: false,
               }}
            />
         </Stack>

         <AudioPlayer />
      </AudioPlaybackProvider>
      {showSplash ? (
         <View style={styles.splashOverlay} pointerEvents="auto">
            <SplashScreen />
         </View>
      ) : null}
      </>
   );
}

export default function RootLayout() {
   return (
      <GestureHandlerRootView style={{ flex: 1 }}>
         <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <ToastProvider>
               <ErrorBoundary>
                  <Provider store={store}>
                     <PersistGate loading={null} persistor={persistor}>
                        <QueryClientProvider client={queryClient}>
                           <DomainEventsSync />
                           <ThemeProvider>
                              <ThemedAppShell>
                                 <InnerLayout />
                                 <EnvironmentBadge />
                                 <Toast />
                              </ThemedAppShell>
                           </ThemeProvider>
                        </QueryClientProvider>
                     </PersistGate>
                  </Provider>
               </ErrorBoundary>
            </ToastProvider>
         </SafeAreaProvider>
      </GestureHandlerRootView>
   );
}
