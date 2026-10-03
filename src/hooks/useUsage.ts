import type { UsageState } from "../lib/usageStore";

export interface UseUsageResult {
  status: UsageState["status"];
  isRefreshing: boolean;
  isRetrying: boolean;
  error: string | null;
  retry: () => Promise<void>;
  refetch: () => Promise<void>;
  hasPaidAccess: boolean | null;
  hasPaidAccessOptimistic: boolean;
  plan: string;
  isPastDue: boolean;
  wordsUsed: number;
  wordsRemaining: number;
  limit: number;
  isSubscribed: boolean;
  isPersonallySubscribed: boolean;
  entitledWorkspaceIds: string[];
  isTrial: boolean;
  trialDaysLeft: number | null;
  currentPeriodEnd: string | null;
  billingInterval: "monthly" | "annual" | null;
  isOverLimit: boolean;
  isApproachingLimit: boolean;
  resetAt: string | null;
  checkoutLoading: boolean;
  openCheckout: (opts?: {
    plan?: "monthly" | "annual";
    tier?: "pro" | "business";
  }) => Promise<{ success: boolean; error?: string }>;
  openBillingPortal: () => Promise<{ success: boolean; error?: string; code?: string }>;
  switchPlan: (opts: {
    plan: "monthly" | "annual";
    tier: "pro" | "business";
  }) => Promise<{ success: boolean; alreadyOnPlan?: boolean; error?: string }>;
  previewSwitchPlan: (opts: { plan: "monthly" | "annual"; tier: "pro" | "business" }) => Promise<{
    success: boolean;
    immediateAmount?: number;
    currency?: string;
    currentPriceAmount?: number;
    currentInterval?: string;
    newPriceAmount?: number;
    newInterval?: string;
    nextBillingDate?: string;
    alreadyOnPlan?: boolean;
    error?: string;
  }>;
}

const STATIC_PRO_USAGE: UseUsageResult = {
  status: "success",
  isRefreshing: false,
  isRetrying: false,
  error: null,
  retry: async () => {},
  refetch: async () => {},
  hasPaidAccess: true,
  hasPaidAccessOptimistic: true,
  plan: "pro",
  isPastDue: false,
  wordsUsed: 0,
  wordsRemaining: 999999999,
  limit: 999999999,
  isSubscribed: true,
  isPersonallySubscribed: true,
  entitledWorkspaceIds: [],
  isTrial: false,
  trialDaysLeft: null,
  currentPeriodEnd: null,
  billingInterval: "annual",
  isOverLimit: false,
  isApproachingLimit: false,
  resetAt: null,
  checkoutLoading: false,
  openCheckout: async () => ({ success: true }),
  openBillingPortal: async () => ({ success: true }),
  switchPlan: async () => ({ success: true }),
  previewSwitchPlan: async () => ({ success: true }),
};

export function useUsage(): UseUsageResult | null {
  return STATIC_PRO_USAGE;
}
