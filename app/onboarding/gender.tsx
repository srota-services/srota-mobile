import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSelector } from 'react-redux';
import { WizardScreenLayout } from '@/components/WizardScreenLayout';
import { SelectableChip } from '@/components/SelectableChip';
import {
   useOnboardingStore,
   GENDER_OPTIONS,
   parseGenderFromApi,
   hydrateOnboardingStoreFromProgress,
   type GenderValue,
} from '@/store/onboarding';
import { RootState } from '@/store';
import { useSignupWizardStepPersistence } from '@/hooks/useSignupWizardStepPersistence';

const TOTAL_STEPS = 4;

/**
 * Onboarding step 2: select gender
 */
export default function OnboardingGenderScreen() {
   const userProfile = useSelector((state: RootState) => state.auth.userProfile);
   const storedGender = useOnboardingStore((s) => s.gender);
   const setStoredGender = useOnboardingStore((s) => s.setGender);

   useSignupWizardStepPersistence('onboarding_gender');

   useEffect(() => {
      hydrateOnboardingStoreFromProgress();
   }, []);

   const [selectedGender, setSelectedGender] = useState<GenderValue | null>(storedGender);
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      if (storedGender !== null) {
         setSelectedGender(storedGender);
         return;
      }
      const fromProfile = parseGenderFromApi(userProfile?.gender);
      if (fromProfile) {
         setStoredGender(fromProfile);
         setSelectedGender(fromProfile);
      }
   }, [userProfile?.gender, storedGender, setStoredGender]);

   const handleSelect = useCallback(
      (value: GenderValue) => {
         setSelectedGender(value);
         setStoredGender(value);
         setError(null);
      },
      [setStoredGender]
   );

   const handleContinue = useCallback(() => {
      if (!selectedGender) {
         setError('Please select a gender');
         return;
      }
      setStoredGender(selectedGender);
      router.push('/onboarding/languages' as Href);
   }, [selectedGender, setStoredGender]);

   const handleBack = useCallback(() => {
      router.back();
   }, []);

   return (
      <WizardScreenLayout
         step={2}
         totalSteps={TOTAL_STEPS}
         title="What's your gender?"
         subtitle="Choose the option that best describes you."
         onContinue={handleContinue}
         onBack={handleBack}
         continueDisabled={!selectedGender}
         error={error}
      >
         <View style={styles.chipGrid}>
            {GENDER_OPTIONS.map((option) => (
               <SelectableChip
                  key={option.value}
                  label={option.label}
                  selected={selectedGender === option.value}
                  onPress={() => handleSelect(option.value)}
                  testID={`onboarding-gender-${option.value}`}
               />
            ))}
         </View>
      </WizardScreenLayout>
   );
}

const styles = StyleSheet.create({
   chipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
   },
});
