export type UpsellDecision = "show" | "hide" | "unknown";

export interface UpsellInput {
  authLoaded: boolean;
  isSignedIn: boolean;
  /** `null` while the entitlement is unresolved. */
  hasPaidAccess: boolean | null;
  isPastDue: boolean;
}

export function decideUpsell({
  authLoaded,
  isSignedIn,
  hasPaidAccess,
  isPastDue,
}: UpsellInput): UpsellDecision {
  return "hide";
}

export type ProPlanCardCta =
  "currentPlan" | "downgradeToPro" | "coveredByWorkspace" | "checkout" | "signUp" | "none";

export interface ProPlanCardInput {
  isSignedIn: boolean;
  /** Signed out, or usage.status === "success". */
  planStateKnown: boolean;
  isPersonallySubscribed: boolean;
  plan: string;
  isTrial: boolean;
  /** SettingsPage's usage-payload predicate — not the workspace store. */
  isWorkspaceCovered: boolean;
}

export function decideProPlanCardCta(i: ProPlanCardInput): ProPlanCardCta {
  if ((i.isPersonallySubscribed && i.plan === "pro" && !i.isTrial) || i.isTrial)
    return "currentPlan";
  if (i.isPersonallySubscribed && i.plan === "business") return "downgradeToPro";
  if (!i.isSignedIn) return "signUp";
  if (!i.planStateKnown) return "none"; // fail-closed while entitlement unknown
  if (i.isWorkspaceCovered) return "coveredByWorkspace"; // the regression fix
  return "checkout";
}
