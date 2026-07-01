import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
   View,
   Text,
   StyleSheet,
   ScrollView,
   ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { ScatteredLanguagePills } from '@/components/onboarding/ScatteredLanguagePills';
import { SelectableChip } from '@/components/SelectableChip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { spacing, typography, borderRadius } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useGenres } from '@/hooks/useGenres';
import { INDIAN_LANGUAGES } from '@/constants/indianLanguages';
import { updateAppUserProfile } from '@/services/user';
import { fetchUserProfile } from '@/store/auth';
import { ApiError } from '@/services/api';
import { AppDispatch, RootState } from '@/store';
import {
   MAX_GENRE_SELECTIONS,
   MAX_LANGUAGE_SELECTIONS,
   toggleSelection,
} from '@/utils/contentPreferences';

export default function ContentPreferencesScreen() {
   const { colors } = useTheme();
   const dispatch = useDispatch<AppDispatch>();
   const userProfile = useSelector((state: RootState) => state.auth.userProfile);

   const styles = useThemedStyles((t) =>
      StyleSheet.create({
         container: {
            flex: 1,
            backgroundColor: t.colors.background.screen,
         },
         scrollView: {
            flex: 1,
         },
         sectionBody: {
            padding: spacing.md,
         },
         selectionHint: {
            fontSize: typography.fontSize.sm,
            color: t.colors.text.secondary,
            marginBottom: spacing.sm,
         },
         yourSelections: {
            fontSize: typography.fontSize.sm,
            fontWeight: '600',
            color: t.colors.text.primary,
            marginBottom: spacing.xs,
         },
         selectionSummary: {
            fontSize: typography.fontSize.sm,
            color: t.colors.text.secondary,
            marginBottom: spacing.md,
            lineHeight: typography.lineHeight.relaxed * typography.fontSize.sm,
         },
         pillsContainer: {
            minHeight: 200,
         },
         chipGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
         },
         loading: {
            paddingVertical: spacing.xl,
            alignItems: 'center',
         },
         errorBanner: {
            marginHorizontal: spacing.md,
            marginBottom: spacing.md,
            padding: spacing.md,
            borderRadius: borderRadius.lg,
            backgroundColor: t.colors.background.card,
         },
         errorText: {
            fontSize: typography.fontSize.sm,
            color: t.colors.error,
            textAlign: 'center',
         },
         saveContainer: {
            paddingHorizontal: spacing.md,
            paddingTop: spacing.md,
         },
      })
   );

   const insets = useSafeAreaInsets();
   const { data: genresData, isLoading: isLoadingGenres, error: genresError } = useGenres();

   const [languageCodes, setLanguageCodes] = useState<string[]>([]);
   const [genreIds, setGenreIds] = useState<string[]>([]);
   const [error, setError] = useState<string | null>(null);
   const [isSubmitting, setIsSubmitting] = useState(false);

   useEffect(() => {
      const prefs = userProfile?.preferences;
      if (prefs?.languages?.length) {
         setLanguageCodes([...prefs.languages]);
      }
      if (prefs?.favoriteGenreIds?.length) {
         setGenreIds([...prefs.favoriteGenreIds]);
      }
   }, [userProfile?.preferences]);

   const genres = useMemo(() => genresData?.data ?? [], [genresData?.data]);
   const atMaxGenres = genreIds.length >= MAX_GENRE_SELECTIONS;

   const selectedLanguageLabels = useMemo(
      () =>
         languageCodes
            .map((code) => INDIAN_LANGUAGES.find((lang) => lang.code === code)?.label)
            .filter((label): label is string => Boolean(label)),
      [languageCodes]
   );

   const selectedGenreNames = useMemo(
      () =>
         genreIds
            .map((id) => genres.find((g) => g.id === id)?.name)
            .filter((name): name is string => Boolean(name)),
      [genreIds, genres]
   );

   const handleBackPress = useCallback(() => {
      router.back();
   }, []);

   const handleToggleLanguage = useCallback((code: string) => {
      setLanguageCodes((current) =>
         toggleSelection(current, code, MAX_LANGUAGE_SELECTIONS)
      );
      setError(null);
   }, []);

   const handleToggleGenre = useCallback((genreId: string) => {
      setGenreIds((current) => toggleSelection(current, genreId, MAX_GENRE_SELECTIONS));
      setError(null);
   }, []);

   const handleSave = useCallback(async () => {
      setError(null);

      if (languageCodes.length === 0) {
         setError('Please select at least one language');
         return;
      }
      if (genreIds.length === 0) {
         setError('Please select at least one genre');
         return;
      }

      setIsSubmitting(true);

      try {
         await updateAppUserProfile({
            preferences: {
               favoriteGenreIds: genreIds,
               languages: languageCodes,
            },
         });
         await dispatch(fetchUserProfile()).unwrap();
         router.back();
      } catch (err) {
         if (err instanceof ApiError) {
            const errorData = err.data as { message?: string } | undefined;
            setError(errorData?.message || 'Failed to save preferences. Please try again.');
         } else {
            setError('Something went wrong. Please try again.');
         }
      } finally {
         setIsSubmitting(false);
      }
   }, [languageCodes, genreIds, dispatch]);

   const displayError =
      error ||
      (genresError instanceof Error
         ? genresError.message
         : genresError
           ? 'Failed to load genres'
           : null);

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
               headerIcon="content-preferences"
               onBack={handleBackPress}
               titleSize="large"
            />
            <ScrollView
               style={styles.scrollView}
               contentContainerStyle={{
                  paddingBottom: insets.bottom + spacing.xl,
               }}
               showsVerticalScrollIndicator={false}
            >
               {displayError ? (
                  <View style={styles.errorBanner}>
                     <Text style={styles.errorText}>{displayError}</Text>
                  </View>
               ) : null}

               <SettingsSection title="Languages">
                  <View style={styles.sectionBody}>
                     <Text style={styles.selectionHint}>
                        {languageCodes.length} of {MAX_LANGUAGE_SELECTIONS} selected
                     </Text>
                     {selectedLanguageLabels.length > 0 ? (
                        <>
                           <Text style={styles.yourSelections}>Your selections</Text>
                           <Text style={styles.selectionSummary}>
                              {selectedLanguageLabels.join(', ')}
                           </Text>
                        </>
                     ) : null}
                     <View style={styles.pillsContainer}>
                        <ScatteredLanguagePills
                           selectedCodes={languageCodes}
                           onToggle={handleToggleLanguage}
                           maxSelections={MAX_LANGUAGE_SELECTIONS}
                        />
                     </View>
                  </View>
               </SettingsSection>

               <SettingsSection title="Genres">
                  <View style={styles.sectionBody}>
                     <Text style={styles.selectionHint}>
                        {genreIds.length} of {MAX_GENRE_SELECTIONS} selected
                     </Text>
                     {selectedGenreNames.length > 0 ? (
                        <>
                           <Text style={styles.yourSelections}>Your selections</Text>
                           <Text style={styles.selectionSummary}>
                              {selectedGenreNames.join(', ')}
                           </Text>
                        </>
                     ) : null}
                     {isLoadingGenres ? (
                        <View style={styles.loading}>
                           <ActivityIndicator size="large" color={colors.accent.primary} />
                        </View>
                     ) : (
                        <View style={styles.chipGrid}>
                           {genres.map((genre) => {
                              const selected = genreIds.includes(genre.id);
                              const disabled = atMaxGenres && !selected;
                              return (
                                 <SelectableChip
                                    key={genre.id}
                                    label={genre.name}
                                    selected={selected}
                                    disabled={disabled}
                                    onPress={() => handleToggleGenre(genre.id)}
                                 />
                              );
                           })}
                        </View>
                     )}
                  </View>
               </SettingsSection>

               <View style={styles.saveContainer}>
                  <PrimaryButton
                     title="Save preferences"
                     onPress={handleSave}
                     loading={isSubmitting}
                     disabled={isSubmitting || isLoadingGenres}
                  />
               </View>
            </ScrollView>
         </SafeAreaView>
      </>
   );
}
