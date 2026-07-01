import { formatGenderForApi, useOnboardingStore } from '@/store/onboarding';
import { persistOnboardingDraftFromStore } from '@/utils/signupWizardStorage';

jest.mock('@/utils/signupWizardStorage', () => ({
   persistOnboardingDraftFromStore: jest.fn(() => Promise.resolve()),
   clearSignupWizardProgress: jest.fn(() => Promise.resolve()),
   getSignupWizardProgress: jest.fn(() => null),
}));

const mockedPersistOnboardingDraft = persistOnboardingDraftFromStore as jest.MockedFunction<
   typeof persistOnboardingDraftFromStore
>;

describe('formatGenderForApi', () => {
   it('returns uppercase gender values for the profile API', () => {
      expect(formatGenderForApi('male')).toBe('MALE');
      expect(formatGenderForApi('female')).toBe('FEMALE');
      expect(formatGenderForApi('non_binary')).toBe('NON_BINARY');
      expect(formatGenderForApi('prefer_not_to_say')).toBe('PREFER_NOT_TO_SAY');
   });
});

describe('useOnboardingStore languageCodes', () => {
   beforeEach(() => {
      jest.clearAllMocks();
      useOnboardingStore.getState().resetOnboarding();
   });

   it('adds a language code when toggled', () => {
      useOnboardingStore.getState().toggleLanguageCode('hi');
      expect(useOnboardingStore.getState().languageCodes).toEqual(['hi']);
   });

   it('removes a language code when toggled again', () => {
      const { toggleLanguageCode } = useOnboardingStore.getState();
      toggleLanguageCode('hi');
      toggleLanguageCode('hi');
      expect(useOnboardingStore.getState().languageCodes).toEqual([]);
   });

   it('allows up to 3 language selections', () => {
      const { toggleLanguageCode } = useOnboardingStore.getState();
      toggleLanguageCode('hi');
      toggleLanguageCode('en');
      toggleLanguageCode('ta');
      toggleLanguageCode('bn');
      expect(useOnboardingStore.getState().languageCodes).toEqual(['hi', 'en', 'ta']);
   });

   it('clears language codes on reset', () => {
      useOnboardingStore.getState().toggleLanguageCode('hi');
      useOnboardingStore.getState().resetOnboarding();
      expect(useOnboardingStore.getState().languageCodes).toEqual([]);
   });

   it('persists onboarding draft when age is set', () => {
      useOnboardingStore.getState().setAge(28);

      expect(mockedPersistOnboardingDraft).toHaveBeenCalledWith({
         age: 28,
         gender: null,
         languageCodes: [],
         genreIds: [],
      });
   });
});
