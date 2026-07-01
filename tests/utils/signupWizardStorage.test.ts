import AsyncStorage from '@react-native-async-storage/async-storage';
import {
   clearSignupWizardProgress,
   loadSignupWizardProgressCache,
   persistSignupWizardProgress,
   resolveSignupWizardRoute,
   signupWizardRouteToHref,
   stepToPath,
} from '@/utils/signupWizardStorage';
import {
   hydrateOnboardingStoreFromProgress,
   useOnboardingStore,
} from '@/store/onboarding';

jest.mock('@react-native-async-storage/async-storage', () => ({
   setItem: jest.fn(() => Promise.resolve()),
   getItem: jest.fn(() => Promise.resolve(null)),
   removeItem: jest.fn(() => Promise.resolve()),
}));

const mockedGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;
const mockedSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;
const mockedRemoveItem = AsyncStorage.removeItem as jest.MockedFunction<
   typeof AsyncStorage.removeItem
>;

describe('signupWizardStorage', () => {
   beforeEach(async () => {
      jest.clearAllMocks();
      mockedGetItem.mockResolvedValue(null);
      useOnboardingStore.getState().resetOnboarding();
      await clearSignupWizardProgress();
   });

   describe('resolveSignupWizardRoute', () => {
      it('routes unauthenticated users with no progress to signin', () => {
         const route = resolveSignupWizardRoute(null, {
            isAuthenticated: false,
            requiresOnboarding: false,
         });

         expect(route).toEqual({ type: 'path', href: '/signin' });
      });

      it('routes unauthenticated users to signup when step is signup', () => {
         const route = resolveSignupWizardRoute(
            { step: 'signup' },
            { isAuthenticated: false, requiresOnboarding: false }
         );

         expect(route).toEqual({ type: 'path', href: '/signup' });
      });

      it('routes unauthenticated users to verify_otp with auto resend', () => {
         const route = resolveSignupWizardRoute(
            { step: 'verify_otp', email: 'user@example.com' },
            { isAuthenticated: false, requiresOnboarding: false }
         );

         expect(route).toEqual({
            type: 'verify_otp',
            email: 'user@example.com',
            autoResendOtp: true,
         });
      });

      it('skips verify_otp for authenticated users who still need onboarding', () => {
         const route = resolveSignupWizardRoute(
            { step: 'verify_otp', email: 'user@example.com' },
            { isAuthenticated: true, requiresOnboarding: true }
         );

         expect(route).toEqual({ type: 'path', href: '/onboarding/age' });
      });

      it('routes authenticated users to persisted onboarding step', () => {
         const route = resolveSignupWizardRoute(
            {
               step: 'onboarding_languages',
               onboardingDraft: {
                  age: 25,
                  gender: 'male',
                  languageCodes: ['hi'],
                  genreIds: [],
               },
            },
            { isAuthenticated: true, requiresOnboarding: true }
         );

         expect(route).toEqual({ type: 'path', href: '/onboarding/languages' });
      });

      it('routes completed users to tabs', () => {
         const route = resolveSignupWizardRoute(
            { step: 'onboarding_genres' },
            { isAuthenticated: true, requiresOnboarding: false }
         );

         expect(route).toEqual({ type: 'path', href: '/(tabs)' });
      });
   });

   describe('signupWizardRouteToHref', () => {
      it('maps verify_otp route to params', () => {
         expect(
            signupWizardRouteToHref({
               type: 'verify_otp',
               email: 'user@example.com',
               autoResendOtp: true,
            })
         ).toEqual({
            pathname: '/verify-otp',
            params: {
               email: 'user@example.com',
               autoResendOtp: 'true',
            },
         });
      });
   });

   describe('stepToPath', () => {
      it('maps onboarding steps to paths', () => {
         expect(stepToPath('onboarding_gender')).toBe('/onboarding/gender');
         expect(stepToPath('onboarding_genres')).toBe('/onboarding/genres');
      });
   });

   describe('persistence', () => {
      it('loads progress into cache from AsyncStorage', async () => {
         mockedGetItem.mockResolvedValueOnce(
            JSON.stringify({
               step: 'verify_otp',
               email: 'user@example.com',
            })
         );

         const progress = await loadSignupWizardProgressCache();

         expect(progress).toEqual({
            step: 'verify_otp',
            email: 'user@example.com',
         });
      });

      it('persists progress to AsyncStorage', async () => {
         await persistSignupWizardProgress({
            step: 'signup',
            signupDraft: {
               email: 'user@example.com',
               address: '123 Main St',
               contact: '9876543210',
            },
         });

         expect(mockedSetItem).toHaveBeenCalledWith(
            '@signup/wizardProgress',
            expect.stringContaining('"step":"signup"')
         );
      });

      it('clears progress from AsyncStorage', async () => {
         await persistSignupWizardProgress({ step: 'signup' });
         await clearSignupWizardProgress();

         expect(mockedRemoveItem).toHaveBeenCalledWith('@signup/wizardProgress');
      });
   });

   describe('hydrateOnboardingStoreFromProgress', () => {
      it('hydrates onboarding store from cached draft', async () => {
         await persistSignupWizardProgress({
            step: 'onboarding_languages',
            onboardingDraft: {
               age: 30,
               gender: 'female',
               languageCodes: ['hi', 'en'],
               genreIds: [],
            },
         });

         hydrateOnboardingStoreFromProgress();

         expect(useOnboardingStore.getState()).toMatchObject({
            age: 30,
            gender: 'female',
            languageCodes: ['hi', 'en'],
            genreIds: [],
         });
      });
   });
});
