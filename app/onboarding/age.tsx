import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { router, type Href } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '@/contexts/ThemeContext';
import { AgeNumberPicker } from '@/components/AgeNumberPicker';
import { WizardScreenLayout } from '@/components/WizardScreenLayout';
import { fetchUserProfile } from '@/store/auth';
import {
   useOnboardingStore,
   MIN_AGE,
   MAX_AGE,
   hydrateOnboardingStoreFromProgress,
} from '@/store/onboarding';
import { AppDispatch, RootState } from '@/store';
import { useSignupWizardStepPersistence } from '@/hooks/useSignupWizardStepPersistence';

const TOTAL_STEPS = 4;
const DEFAULT_AGE = 25;

function clampAge(age: number): number {
   return Math.min(MAX_AGE, Math.max(MIN_AGE, age));
}

function resolveInitialAge(
   storedAge: number | null,
   profileAge: number | null | undefined
): number {
   if (storedAge !== null) {
      return clampAge(storedAge);
   }
   if (profileAge != null && profileAge > 0) {
      return clampAge(profileAge);
   }
   return DEFAULT_AGE;
}

/**
 * Onboarding step 1: select age via scroll wheel and load profile for pre-fill
 */
export default function OnboardingAgeScreen() {
   const { colors } = useTheme();
   const dispatch = useDispatch<AppDispatch>();
   const userProfile = useSelector((state: RootState) => state.auth.userProfile);
   const profileFetched = useSelector((state: RootState) => state.auth.profileFetched);

   useSignupWizardStepPersistence('onboarding_age');

   useEffect(() => {
      hydrateOnboardingStoreFromProgress();
   }, []);

   const storedAge = useOnboardingStore((s) => s.age);
   const setStoredAge = useOnboardingStore((s) => s.setAge);

   const [selectedAge, setSelectedAge] = useState(() =>
      resolveInitialAge(storedAge, userProfile?.age)
   );
   const [isLoadingProfile, setIsLoadingProfile] = useState(!profileFetched);

   useEffect(() => {
      const loadProfile = async () => {
         if (profileFetched) {
            setIsLoadingProfile(false);
            return;
         }
         try {
            await dispatch(fetchUserProfile()).unwrap();
         } catch (profileError) {
            console.error('[OnboardingAge] Failed to fetch user profile:', profileError);
         } finally {
            setIsLoadingProfile(false);
         }
      };

      void loadProfile();
   }, [dispatch, profileFetched]);

   useEffect(() => {
      if (storedAge !== null) {
         setSelectedAge(clampAge(storedAge));
         return;
      }
      if (userProfile?.age != null && userProfile.age > 0) {
         const fromProfile = clampAge(userProfile.age);
         setStoredAge(fromProfile);
         setSelectedAge(fromProfile);
      }
   }, [userProfile?.age, storedAge, setStoredAge]);

   const handleAgeChange = useCallback(
      (age: number) => {
         setSelectedAge(age);
         setStoredAge(age);
      },
      [setStoredAge]
   );

   const handleContinue = useCallback(() => {
      setStoredAge(selectedAge);
      router.push('/onboarding/gender' as Href);
   }, [selectedAge, setStoredAge]);

   return (
      <WizardScreenLayout
         step={1}
         totalSteps={TOTAL_STEPS}
         title="How old are you?"
         subtitle="This helps us personalize your listening experience."
         onContinue={handleContinue}
         continueDisabled={isLoadingProfile}
         scrollable={false}
      >
         {isLoadingProfile ? (
            <View style={styles.loading}>
               <ActivityIndicator size="large" color={colors.accent.primary} />
            </View>
         ) : (
            <AgeNumberPicker
               value={selectedAge}
               onValueChange={handleAgeChange}
               minAge={MIN_AGE}
               maxAge={MAX_AGE}
               testID="onboarding-age-picker"
            />
         )}
      </WizardScreenLayout>
   );
}

const styles = StyleSheet.create({
   loading: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
   },
});
