import {
   formatSubscriptionAccessMessage,
   getRequiredTierLabel,
   normalizeSubscriptionTierCode,
} from '@/utils/subscriptionAccessDisplay';
import type { SubscriptionPlan } from '@/services/subscriptions';

function makePlan(overrides: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
   return {
      id: 'plan-1',
      name: 'Standard Plan',
      description: '',
      price: 9.99,
      currency: 'USD',
      tierLevel: 2,
      billingInterval: 'monthly',
      trialDays: 0,
      features: {
         maxDevices: 3,
         audioQuality: 'high',
         audiobookCatalog: 'all',
         deviceChangesPerMonth: 2,
      },
      featureDescriptions: [],
      isActive: true,
      createdAt: '',
      updatedAt: '',
      ...overrides,
   };
}

describe('normalizeSubscriptionTierCode', () => {
   it('accepts tier enum strings from the API', () => {
      expect(normalizeSubscriptionTierCode('STANDARD')).toBe('STANDARD');
      expect(normalizeSubscriptionTierCode('base')).toBe('BASE');
   });

   it('accepts numeric tier aliases', () => {
      expect(normalizeSubscriptionTierCode(3)).toBe('PREMIUM');
   });
});

describe('getRequiredTierLabel', () => {
   it('uses catalog plan names when available', () => {
      expect(
         getRequiredTierLabel('STANDARD', [
            makePlan({ name: 'Custom Standard', tierLevel: 2 }),
         ])
      ).toBe('Custom Standard');
   });

   it('falls back to default labels', () => {
      expect(getRequiredTierLabel('PREMIUM')).toBe('Premium');
   });
});

describe('formatSubscriptionAccessMessage', () => {
   it('combines API message with required tier guidance', () => {
      expect(
         formatSubscriptionAccessMessage({
            message:
               'Your current subscription plan does not include access to this Chapter',
            requiredTier: 'STANDARD',
         })
      ).toBe(
         'Your current subscription plan does not include access to this Chapter This content requires the Standard plan or higher.'
      );
   });

   it('returns message alone when tier is missing', () => {
      expect(
         formatSubscriptionAccessMessage({
            message: 'Please log in to access this content',
         })
      ).toBe('Please log in to access this content');
   });

   it('returns tier guidance alone when message is missing', () => {
      expect(
         formatSubscriptionAccessMessage({
            requiredTier: 'BASE',
         })
      ).toBe('This content requires the Base plan or higher.');
   });

   it('avoids repeating tier text already present in the message', () => {
      expect(
         formatSubscriptionAccessMessage({
            message: 'Upgrade to the Premium plan to unlock this chapter',
            requiredTier: 'PREMIUM',
         })
      ).toBe('Upgrade to the Premium plan to unlock this chapter');
   });

   it('uses subscription plan names from the catalog', () => {
      expect(
         formatSubscriptionAccessMessage(
            {
               message: 'Subscription required',
               requiredTier: 'STANDARD',
            },
            [
               makePlan({ name: 'Plus Membership', tierLevel: 2 }),
               makePlan({ id: 'plan-3', name: 'Premium Plan', tierLevel: 3 }),
            ]
         )
      ).toBe(
         'Subscription required This content requires the Plus Membership plan or higher.'
      );
   });

   it('does not say or higher for the top Premium tier', () => {
      expect(
         formatSubscriptionAccessMessage({
            message: 'Subscription required',
            requiredTier: 'PREMIUM',
         })
      ).toBe('Subscription required This content requires the Premium plan.');

      expect(
         formatSubscriptionAccessMessage({
            requiredTier: 'PREMIUM',
         })
      ).toBe('This content requires the Premium plan.');
   });

   it('does not say or higher when required tier is the catalog maximum', () => {
      expect(
         formatSubscriptionAccessMessage(
            {
               requiredTier: 'STANDARD',
            },
            [
               makePlan({ name: 'Base', tierLevel: 1 }),
               makePlan({ id: 'plan-2', name: 'Standard', tierLevel: 2 }),
            ]
         )
      ).toBe('This content requires the Standard plan.');
   });
});
