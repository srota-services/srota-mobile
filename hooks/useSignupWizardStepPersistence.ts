import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
   persistSignupWizardStep,
   type SignupWizardStep,
} from '@/utils/signupWizardStorage';

/**
 * Persists the current signup wizard step whenever this screen is focused.
 */
export function useSignupWizardStepPersistence(step: SignupWizardStep): void {
   useFocusEffect(
      useCallback(() => {
         void persistSignupWizardStep(step);
      }, [step])
   );
}
