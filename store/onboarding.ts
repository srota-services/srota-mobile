/**
 * Signup wizard draft state (in-memory across onboarding screens)
 */

import { create } from 'zustand';
import { MAX_LANGUAGE_SELECTIONS } from '@/constants/indianLanguages';
import {
   getSignupWizardProgress,
   persistOnboardingDraftFromStore,
   clearSignupWizardProgress,
   type OnboardingDraft,
} from '@/utils/signupWizardStorage';

export { MAX_LANGUAGE_SELECTIONS };

export const GENDER_OPTIONS = [
   { value: 'male', label: 'Male' },
   { value: 'female', label: 'Female' },
   { value: 'non_binary', label: 'Non-binary' },
   { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const;

export type GenderValue = (typeof GENDER_OPTIONS)[number]['value'];

/** API expects gender in uppercase (e.g. MALE, NON_BINARY). */
export function formatGenderForApi(gender: GenderValue): string {
   return gender.toUpperCase();
}

/** Maps auth-service gender enum to onboarding store value (e.g. MALE → male). */
export function parseGenderFromApi(gender: string | null | undefined): GenderValue | null {
   if (!gender || !gender.trim()) {
      return null;
   }
   const normalized = gender.trim().toLowerCase();
   const match = GENDER_OPTIONS.find((option) => option.value === normalized);
   return match?.value ?? null;
}

export const MIN_AGE = 13;
export const MAX_AGE = 120;
export const MAX_GENRE_SELECTIONS = 3;

interface OnboardingState {
   age: number | null;
   gender: GenderValue | null;
   languageCodes: string[];
   genreIds: string[];
   setAge: (age: number | null) => void;
   setGender: (gender: GenderValue | null) => void;
   toggleLanguageCode: (code: string) => void;
   toggleGenreId: (genreId: string) => void;
   resetOnboarding: () => void;
}

const initialState = {
   age: null as number | null,
   gender: null as GenderValue | null,
   languageCodes: [] as string[],
   genreIds: [] as string[],
};

function getOnboardingDraftFromState(state: OnboardingState): OnboardingDraft {
   return {
      age: state.age,
      gender: state.gender,
      languageCodes: state.languageCodes,
      genreIds: state.genreIds,
   };
}

function syncOnboardingDraftToStorage(): void {
   const state = useOnboardingStore.getState();
   void persistOnboardingDraftFromStore(getOnboardingDraftFromState(state));
}

function isOnboardingStoreEmpty(state: OnboardingState): boolean {
   return (
      state.age === null &&
      state.gender === null &&
      state.languageCodes.length === 0 &&
      state.genreIds.length === 0
   );
}

export function hydrateOnboardingStoreFromProgress(): void {
   const draft = getSignupWizardProgress()?.onboardingDraft;
   if (!draft) {
      return;
   }

   const current = useOnboardingStore.getState();
   if (!isOnboardingStoreEmpty(current)) {
      return;
   }

   useOnboardingStore.setState({
      age: draft.age,
      gender: draft.gender,
      languageCodes: [...draft.languageCodes],
      genreIds: [...draft.genreIds],
   });
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
   ...initialState,
   setAge: (age) => {
      set({ age });
      syncOnboardingDraftToStorage();
   },
   setGender: (gender) => {
      set({ gender });
      syncOnboardingDraftToStorage();
   },
   toggleLanguageCode: (code) => {
      const { languageCodes } = get();
      if (languageCodes.includes(code)) {
         set({ languageCodes: languageCodes.filter((c) => c !== code) });
      } else if (languageCodes.length < MAX_LANGUAGE_SELECTIONS) {
         set({ languageCodes: [...languageCodes, code] });
      }
      syncOnboardingDraftToStorage();
   },
   toggleGenreId: (genreId) => {
      const { genreIds } = get();
      if (genreIds.includes(genreId)) {
         set({ genreIds: genreIds.filter((id) => id !== genreId) });
      } else if (genreIds.length < MAX_GENRE_SELECTIONS) {
         set({ genreIds: [...genreIds, genreId] });
      }
      syncOnboardingDraftToStorage();
   },
   resetOnboarding: () => {
      set(initialState);
      void clearSignupWizardProgress();
   },
}));
