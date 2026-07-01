import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router, type Href } from 'expo-router';
import { WizardScreenLayout } from '@/components/WizardScreenLayout';
import { ScatteredLanguagePills } from '@/components/onboarding/ScatteredLanguagePills';
import {
   useOnboardingStore,
   MAX_LANGUAGE_SELECTIONS,
   hydrateOnboardingStoreFromProgress,
} from '@/store/onboarding';
import { spacing, typography } from '@/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useSignupWizardStepPersistence } from '@/hooks/useSignupWizardStepPersistence';

const TOTAL_STEPS = 4;

/**
 * Onboarding step 3: select up to 3 languages
 */
export default function OnboardingLanguagesScreen() {
   const styles = useThemedStyles((t) =>
      StyleSheet.create({
   selectionHint: {
      fontSize: typography.fontSize.sm,
      color: t.colors.text.secondaryDark,
      marginBottom: spacing.md,
      textAlign: 'center',
      width: '100%',
   },
   pillsContainer: {
      flex: 1,
      width: '100%',
   },
      })
   );

   const languageCodes = useOnboardingStore((s) => s.languageCodes);
   const toggleLanguageCode = useOnboardingStore((s) => s.toggleLanguageCode);

   useSignupWizardStepPersistence('onboarding_languages');

   useEffect(() => {
      hydrateOnboardingStoreFromProgress();
   }, []);

   const [error, setError] = useState<string | null>(null);

   const handleContinue = useCallback(() => {
      if (languageCodes.length === 0) {
         setError('Please select at least one language');
         return;
      }
      setError(null);
      router.push('/onboarding/genres' as Href);
   }, [languageCodes.length]);

   const handleBack = useCallback(() => {
      router.back();
   }, []);

   const handleToggle = useCallback(
      (code: string) => {
         toggleLanguageCode(code);
         setError(null);
      },
      [toggleLanguageCode]
   );

   return (
      <WizardScreenLayout
         step={3}
         totalSteps={TOTAL_STEPS}
         title="Which languages do you listen in?"
         subtitle={`Select up to ${MAX_LANGUAGE_SELECTIONS} languages.`}
         onContinue={handleContinue}
         onBack={handleBack}
         continueDisabled={languageCodes.length === 0}
         error={error}
         scrollable={false}
         centerBody={false}
      >
         <Text style={styles.selectionHint}>
            {languageCodes.length} of {MAX_LANGUAGE_SELECTIONS} selected
         </Text>

         <View style={styles.pillsContainer}>
            <ScatteredLanguagePills
               selectedCodes={languageCodes}
               onToggle={handleToggle}
               maxSelections={MAX_LANGUAGE_SELECTIONS}
            />
         </View>
      </WizardScreenLayout>
   );
}

