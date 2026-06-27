import type { User } from '@/services/auth';

export function isGuestUser(user: User | null | undefined): boolean {
   return user?.role === 'GUEST';
}
