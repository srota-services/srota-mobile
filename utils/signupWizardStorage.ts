/**
 * Persists signup wizard step and draft data so users can resume after app kill.
 * Non-sensitive fields only — never store passwords.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Href } from 'expo-router';
import type { GenderValue } from '@/store/onboarding';

const WIZARD_PROGRESS_KEY = '@signup/wizardProgress';

export type SignupWizardStep =
   | 'signup'
   | 'verify_otp'
   | 'onboarding_age'
   | 'onboarding_gender'
   | 'onboarding_languages'
   | 'onboarding_genres';

export interface SignupDraft {
   email: string;
   address: string;
   contact: string;
}

export interface OnboardingDraft {
   age: number | null;
   gender: GenderValue | null;
   languageCodes: string[];
   genreIds: string[];
}

export interface SignupWizardProgress {
   step: SignupWizardStep;
   email?: string;
   signupDraft?: SignupDraft;
   onboardingDraft?: OnboardingDraft;
}

export interface SignupWizardRouteContext {
   isAuthenticated: boolean;
   requiresOnboarding: boolean;
}

export type SignupWizardRoute =
   | { type: 'path'; href: Href }
   | { type: 'verify_otp'; email: string; autoResendOtp: boolean };

const ONBOARDING_STEPS: SignupWizardStep[] = [
   'onboarding_age',
   'onboarding_gender',
   'onboarding_languages',
   'onboarding_genres',
];

const PRE_ONBOARDING_STEPS: SignupWizardStep[] = ['signup', 'verify_otp'];

let cachedProgress: SignupWizardProgress | null = null;

function isSignupWizardStep(value: unknown): value is SignupWizardStep {
   return (
      value === 'signup' ||
      value === 'verify_otp' ||
      value === 'onboarding_age' ||
      value === 'onboarding_gender' ||
      value === 'onboarding_languages' ||
      value === 'onboarding_genres'
   );
}

function parseStoredProgress(raw: string | null): SignupWizardProgress | null {
   if (!raw || raw.trim().length === 0) {
      return null;
   }

   try {
      const parsed = JSON.parse(raw) as SignupWizardProgress;
      if (!parsed || typeof parsed !== 'object' || !isSignupWizardStep(parsed.step)) {
         return null;
      }
      return parsed;
   } catch {
      return null;
   }
}

export function getSignupWizardProgress(): SignupWizardProgress | null {
   return cachedProgress;
}

export async function loadSignupWizardProgressCache(): Promise<SignupWizardProgress | null> {
   const raw = await AsyncStorage.getItem(WIZARD_PROGRESS_KEY);
   cachedProgress = parseStoredProgress(raw);
   return cachedProgress;
}

export async function persistSignupWizardProgress(
   progress: SignupWizardProgress
): Promise<void> {
   cachedProgress = progress;
   await AsyncStorage.setItem(WIZARD_PROGRESS_KEY, JSON.stringify(progress));
}

export async function patchSignupWizardProgress(
   patch: Partial<SignupWizardProgress>
): Promise<void> {
   const current = cachedProgress ?? { step: 'signup' as SignupWizardStep };
   await persistSignupWizardProgress({ ...current, ...patch });
}

export async function clearSignupWizardProgress(): Promise<void> {
   cachedProgress = null;
   await AsyncStorage.removeItem(WIZARD_PROGRESS_KEY);
}

export function stepToPath(step: SignupWizardStep): Href {
   switch (step) {
      case 'signup':
         return '/signup';
      case 'verify_otp':
         return '/verify-otp';
      case 'onboarding_age':
         return '/onboarding/age';
      case 'onboarding_gender':
         return '/onboarding/gender';
      case 'onboarding_languages':
         return '/onboarding/languages';
      case 'onboarding_genres':
         return '/onboarding/genres';
   }
}

function isOnboardingStep(step: SignupWizardStep): boolean {
   return ONBOARDING_STEPS.includes(step);
}

function resolveOnboardingStepFromProgress(
   progress: SignupWizardProgress | null
): SignupWizardStep {
   if (progress?.step && isOnboardingStep(progress.step)) {
      return progress.step;
   }

   const draft = progress?.onboardingDraft;
   if (!draft) {
      return 'onboarding_age';
   }

   if (draft.languageCodes.length > 0 && draft.genreIds.length > 0) {
      return 'onboarding_genres';
   }
   if (draft.languageCodes.length > 0) {
      return 'onboarding_languages';
   }
   if (draft.gender) {
      return 'onboarding_gender';
   }
   if (draft.age !== null) {
      return 'onboarding_age';
   }

   return 'onboarding_age';
}

export function resolveSignupWizardRoute(
   progress: SignupWizardProgress | null,
   context: SignupWizardRouteContext
): SignupWizardRoute {
   const { isAuthenticated, requiresOnboarding } = context;

   if (isAuthenticated) {
      if (requiresOnboarding) {
         const step = resolveOnboardingStepFromProgress(progress);
         return { type: 'path', href: stepToPath(step) };
      }
      return { type: 'path', href: '/(tabs)' };
   }

   if (!progress) {
      return { type: 'path', href: '/signin' };
   }

   if (progress.step === 'signup') {
      return { type: 'path', href: '/signup' };
   }

   if (progress.step === 'verify_otp' && progress.email) {
      return {
         type: 'verify_otp',
         email: progress.email,
         autoResendOtp: true,
      };
   }

   if (PRE_ONBOARDING_STEPS.includes(progress.step)) {
      return { type: 'path', href: '/signin' };
   }

   return { type: 'path', href: '/signin' };
}

export function signupWizardRouteToHref(route: SignupWizardRoute): Href {
   if (route.type === 'verify_otp') {
      return {
         pathname: '/verify-otp',
         params: {
            email: route.email,
            autoResendOtp: route.autoResendOtp ? 'true' : 'false',
         },
      };
   }
   return route.href;
}

export async function persistSignupWizardStep(step: SignupWizardStep): Promise<void> {
   await patchSignupWizardProgress({ step });
}

export async function persistOnboardingDraftFromStore(draft: OnboardingDraft): Promise<void> {
   const current = cachedProgress ?? { step: 'onboarding_age' as SignupWizardStep };
   await persistSignupWizardProgress({
      ...current,
      onboardingDraft: draft,
   });
}
