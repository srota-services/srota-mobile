import { isGuestUser } from '@/utils/guestUser';
import type { User } from '@/services/auth';

describe('isGuestUser', () => {
   it('returns true for GUEST role', () => {
      const user: User = {
         id: 'guest-1',
         email: 'guest@example.com',
         role: 'GUEST',
         emailVerified: true,
      };

      expect(isGuestUser(user)).toBe(true);
   });

   it('returns false for registered listener role', () => {
      const user: User = {
         id: 'user-1',
         email: 'user@example.com',
         role: 'LISTENER',
         emailVerified: true,
      };

      expect(isGuestUser(user)).toBe(false);
   });

   it('returns false for null or undefined user', () => {
      expect(isGuestUser(null)).toBe(false);
      expect(isGuestUser(undefined)).toBe(false);
   });
});
