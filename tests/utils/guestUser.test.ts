import { isGuestUser, getHomeGreetingName } from '@/utils/guestUser';
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

describe('getHomeGreetingName', () => {
   const guestUser: User = {
      id: 'guest-1',
      email: 'guest@example.com',
      role: 'GUEST',
      emailVerified: true,
   };

   const listenerUser: User = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'LISTENER',
      emailVerified: true,
   };

   it('returns "there Guest" for guest users', () => {
      expect(getHomeGreetingName(guestUser)).toBe('there Guest');
      expect(getHomeGreetingName(guestUser, 'Alex')).toBe('there Guest');
   });

   it('returns first name for registered users when available', () => {
      expect(getHomeGreetingName(listenerUser, 'Alex')).toBe('Alex');
   });

   it('returns "there" for registered users without a first name', () => {
      expect(getHomeGreetingName(listenerUser)).toBe('there');
      expect(getHomeGreetingName(null)).toBe('there');
   });
});
