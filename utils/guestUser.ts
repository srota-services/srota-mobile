import type { User } from '@/services/auth';

export function isGuestUser(user: User | null | undefined): boolean {
   return user?.role === 'GUEST';
}

export function getHomeGreetingName(
   user: User | null | undefined,
   firstName?: string | null
): string {
   if (isGuestUser(user)) {
      return 'Guest';
   }

   if (firstName) {
      return firstName;
   }

   return '';
}
