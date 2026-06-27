import { isAuthProvider } from '@/services/auth';

jest.mock('@react-native-google-signin/google-signin', () => ({
   GoogleSignin: {
      configure: jest.fn(),
      signOut: jest.fn(() => Promise.resolve()),
      revokeAccess: jest.fn(() => Promise.resolve()),
   },
}));

const { GoogleSignin } = jest.requireMock('@react-native-google-signin/google-signin');
const { revokeGoogleSignInSession } = require('@/services/auth') as typeof import('@/services/auth');

describe('isAuthProvider', () => {
   it('accepts valid providers', () => {
      expect(isAuthProvider('email')).toBe(true);
      expect(isAuthProvider('email_registration')).toBe(true);
      expect(isAuthProvider('google')).toBe(true);
      expect(isAuthProvider('guest')).toBe(true);
   });

   it('rejects invalid values', () => {
      expect(isAuthProvider('facebook')).toBe(false);
      expect(isAuthProvider('')).toBe(false);
   });
});

describe('revokeGoogleSignInSession', () => {
   beforeEach(() => {
      jest.clearAllMocks();
   });

   it('calls signOut and revokeAccess', async () => {
      await revokeGoogleSignInSession();

      expect(GoogleSignin.signOut).toHaveBeenCalledTimes(1);
      expect(GoogleSignin.revokeAccess).toHaveBeenCalledTimes(1);
   });

   it('does not throw when Google SDK fails', async () => {
      GoogleSignin.signOut.mockRejectedValueOnce(new Error('SDK error'));

      await expect(revokeGoogleSignInSession()).resolves.toBeUndefined();
   });
});
