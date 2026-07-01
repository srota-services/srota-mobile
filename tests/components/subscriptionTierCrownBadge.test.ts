import { hasPaidSubscriptionTier } from '@/components/SubscriptionTierCrownBadge';

describe('hasPaidSubscriptionTier', () => {
   it('returns false when minSubscriptionTier is undefined', () => {
      expect(hasPaidSubscriptionTier(undefined)).toBe(false);
   });

   it('returns false when minSubscriptionTier is null', () => {
      expect(hasPaidSubscriptionTier(null)).toBe(false);
   });

   it('returns true when minSubscriptionTier is set', () => {
      expect(hasPaidSubscriptionTier(0)).toBe(true);
      expect(hasPaidSubscriptionTier(2)).toBe(true);
   });
});
