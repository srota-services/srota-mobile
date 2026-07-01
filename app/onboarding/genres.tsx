import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useDispatch } from 'react-redux';
import { WizardScreenLayout } from '@/components/WizardScreenLayout';
import { SelectableChip } from '@/components/SelectableChip';
import { useGenres } from '@/hooks/useGenres';
import { syncUserLocationToProfile } from '@/services/location';
import { updateAuthUserProfile } from '@/services/authProfile';
import { updateAppUserProfile } from '@/services/user';
import { completeOnboarding, fetchUserProfile } from '@/store/auth';
import {
   useOnboardingStore,
   MAX_GENRE_SELECTIONS,
   formatGenderForApi,
   hydrateOnboardingStoreFromProgress,
} from '@/store/onboarding';
import { AppDispatch } from '@/store';
import { ApiError } from '@/services/api';
import { spacing, typography } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useSignupWizardStepPersistence } from '@/hooks/useSignupWizardStepPersistence';

const TOTAL_STEPS = 4;

/**
 * Onboarding step 3: select up to 3 genres and submit profile update
 */
export default function OnboardingGenresScreen() {
   const { colors } = useTheme();
   const styles = useThemedStyles((t) =>
      StyleSheet.create({
   selectionHint: {
      fontSize: typography.fontSize.sm,
      color: t.colors.text.secondaryDark,
      marginBottom: spacing.md,
      textAlign: 'center',
      width: '100%',
   },
   loading: {
      paddingVertical: spacing.xl,
      alignItems: 'center',
   },
   chipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
   },
      })
   );

   const dispatch = useDispatch<AppDispatch>();

   useSignupWizardStepPersistence('onboarding_genres');

   useEffect(() => {
      hydrateOnboardingStoreFromProgress();
   }, []);

   const age = useOnboardingStore((s) => s.age);
   const gender = useOnboardingStore((s) => s.gender);
   const languageCodes = useOnboardingStore((s) => s.languageCodes);
   const genreIds = useOnboardingStore((s) => s.genreIds);
   const toggleGenreId = useOnboardingStore((s) => s.toggleGenreId);

   const { data: genresData, isLoading: isLoadingGenres, error: genresError } = useGenres();

   const [error, setError] = useState<string | null>(null);
   const [isSubmitting, setIsSubmitting] = useState(false);

   const genres = genresData?.data ?? [];
   const atMaxSelection = genreIds.length >= MAX_GENRE_SELECTIONS;

   const handleBack = useCallback(() => {
      router.back();
   }, []);

   const handleSubmit = useCallback(async () => {
      setError(null);

      if (age === null) {
         setError('Age is required. Please go back and enter your age.');
         return;
      }
      if (!gender) {
         setError('Gender is required. Please go back and select your gender.');
         return;
      }
      if (languageCodes.length === 0) {
         setError('Languages are required. Please go back and select your languages.');
         return;
      }
      if (genreIds.length === 0) {
         setError('Please select at least one genre');
         return;
      }

      setIsSubmitting(true);

      try {
         await updateAuthUserProfile({
            age,
            gender: formatGenderForApi(gender),
         });

         await updateAppUserProfile({
            preferences: {
               favoriteGenreIds: genreIds,
               languages: languageCodes,
            },
         });

         await syncUserLocationToProfile();

         try {
            await dispatch(fetchUserProfile()).unwrap();
         } catch (profileError) {
            console.error('[OnboardingGenres] Failed to refresh profile:', profileError);
         }

         dispatch(completeOnboarding());
         router.replace('/(tabs)');
      } catch (err) {
         if (err instanceof ApiError) {
            const errorData = err.data as { message?: string } | undefined;
            setError(errorData?.message || 'Failed to save your preferences. Please try again.');
         } else {
            setError('Something went wrong. Please try again.');
         }
      } finally {
         setIsSubmitting(false);
      }
   }, [age, gender, languageCodes, genreIds, dispatch]);

   const displayError =
      error ||
      (genresError instanceof Error ? genresError.message : genresError ? 'Failed to load genres' : null);

   return (
      <WizardScreenLayout
         step={4}
         totalSteps={TOTAL_STEPS}
         title="Pick your favorite genres"
         subtitle={`Select up to ${MAX_GENRE_SELECTIONS} genres you enjoy most.`}
         onContinue={handleSubmit}
         continueLabel="Finish"
         onBack={handleBack}
         continueDisabled={genreIds.length === 0 || isLoadingGenres}
         isLoading={isSubmitting}
         error={displayError}
      >
         <Text style={styles.selectionHint}>
            {genreIds.length} of {MAX_GENRE_SELECTIONS} selected
         </Text>

         {isLoadingGenres ? (
            <View style={styles.loading}>
               <ActivityIndicator size="large" color={colors.accent.primary} />
            </View>
         ) : (
            <View style={styles.chipGrid}>
               {genres.map((genre) => {
                  const selected = genreIds.includes(genre.id);
                  const disabled = atMaxSelection && !selected;
                  return (
                     <SelectableChip
                        key={genre.id}
                        label={genre.name}
                        selected={selected}
                        disabled={disabled}
                        onPress={() => toggleGenreId(genre.id)}
                        testID={`onboarding-genre-${genre.id}`}
                     />
                  );
               })}
            </View>
         )}
      </WizardScreenLayout>
   );
}

