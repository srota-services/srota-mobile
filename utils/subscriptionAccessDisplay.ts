import type { SubscriptionAccess } from '@/services/audiobooks';
import type { SubscriptionPlan } from '@/services/subscriptions';

export type SubscriptionTierCode = 'BASE' | 'STANDARD' | 'PREMIUM';

/** Values that may appear on API payloads before normalization. */
export type SubscriptionTierInput = SubscriptionTierCode | number | string;

const TIER_ORDER: Record<SubscriptionTierCode, number> = {
   BASE: 1,
   STANDARD: 2,
   PREMIUM: 3,
};

const DEFAULT_TIER_LABELS: Record<SubscriptionTierCode, string> = {
   BASE: 'Base',
   STANDARD: 'Standard',
   PREMIUM: 'Premium',
};

export function normalizeSubscriptionTierCode(
   tier: SubscriptionTierInput | null | undefined
): SubscriptionTierCode | null {
   if (tier == null) {
      return null;
   }

   if (typeof tier === 'number') {
      const match = (Object.entries(TIER_ORDER) as [SubscriptionTierCode, number][]).find(
         ([, order]) => order === tier
      );
      return match?.[0] ?? null;
   }

   const normalized = tier.trim().toUpperCase();
   if (normalized === 'BASE' || normalized === 'STANDARD' || normalized === 'PREMIUM') {
      return normalized;
   }

   return null;
}

export function getRequiredTierLabel(
   tier: SubscriptionTierCode,
   plans?: SubscriptionPlan[]
): string {
   const tierLevel = TIER_ORDER[tier];
   const matchingPlan = plans?.find((plan) => plan.tierLevel === tierLevel && plan.isActive);

   if (matchingPlan?.name?.trim()) {
      return matchingPlan.name.trim();
   }

   return DEFAULT_TIER_LABELS[tier];
}

function messageAlreadyMentionsTier(message: string, tierLabel: string): boolean {
   return message.toLowerCase().includes(tierLabel.toLowerCase());
}

function isMaxRequiredTier(
   tierCode: SubscriptionTierCode,
   plans?: SubscriptionPlan[]
): boolean {
   if (tierCode === 'PREMIUM') {
      return true;
   }

   const activePlans = (plans ?? []).filter((plan) => plan.isActive);
   if (activePlans.length === 0) {
      return false;
   }

   const maxTierLevel = Math.max(...activePlans.map((plan) => plan.tierLevel));
   return TIER_ORDER[tierCode] >= maxTierLevel;
}

function buildTierRequirement(
   tierCode: SubscriptionTierCode,
   tierLabel: string,
   plans?: SubscriptionPlan[]
): string {
   if (isMaxRequiredTier(tierCode, plans)) {
      return `This content requires the ${tierLabel} plan.`;
   }

   return `This content requires the ${tierLabel} plan or higher.`;
}

/**
 * Builds user-facing copy for locked content from API subscriptionAccess fields.
 */
export function formatSubscriptionAccessMessage(
   subscriptionAccess: Pick<SubscriptionAccess, 'message' | 'requiredTier'> | undefined,
   plans?: SubscriptionPlan[]
): string | null {
   if (!subscriptionAccess) {
      return null;
   }

   const message = subscriptionAccess.message?.trim();
   const tierCode = normalizeSubscriptionTierCode(subscriptionAccess.requiredTier);
   const tierLabel = tierCode ? getRequiredTierLabel(tierCode, plans) : null;
   const tierRequirement =
      tierCode && tierLabel ? buildTierRequirement(tierCode, tierLabel, plans) : null;

   if (message && tierRequirement) {
      if (messageAlreadyMentionsTier(message, tierLabel!)) {
         return message;
      }

      return `${message} ${tierRequirement}`;
   }

   if (message) {
      return message;
   }

   return tierRequirement;
}
