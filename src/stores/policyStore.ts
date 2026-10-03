import { create } from "zustand";
import logger from "../utils/logger";
import type { OrgPolicy } from "../types/policy";
import {
  POLICY_SUCCESS_REFRESH_MS,
  resolvedPolicyRefreshIdentity,
  shouldAcceptPolicySnapshot,
  shouldPreserveResolvedPolicyOnFailure,
} from "./policyLifecycle";
import type { PolicyDecisionSnapshot } from "./policyRules";

export interface PolicyState extends PolicyDecisionSnapshot {
  /** Account whose policy is represented by this renderer state. */
  accountId: string | null;
  authGeneration: number | null;
  revision: number;
  /** True once the org enforces a policy on this user. */
  managed: boolean;
  fetchPolicy: (accountId: string, authGeneration: number) => Promise<void>;
  clearPolicy: () => void;
  /**
   * Fail-closed placeholder while account reconciliation resolves the active
   * identity. Unlike clearPolicy (idle = allowed), "loading" denies managed
   * actions until the new account's policy is fetched.
   */
  suspendPolicy: () => void;
}

// Several components mount useAuth at startup; share one in-flight fetch
// between them instead of hitting the API once per consumer.
let fetchInFlight: {
  accountId: string;
  authGeneration: number;
  promise: Promise<void>;
} | null = null;
let fetchSequence = 0;
let lifecycleListenersReady = false;
let appVersionPromise: Promise<string | null> | null = null;

interface PolicyIpcSnapshot {
  success: boolean;
  status?: string;
  revision?: number;
  accountId?: string | null;
  authGeneration?: number | null;
  managed?: boolean;
  policy?: OrgPolicy | null;
  policyUpdatedAt?: string | null;
  endpointSupported?: boolean;
  code?: string;
  error?: string;
}

function readAppVersion(): Promise<string | null> {
  if (!appVersionPromise) {
    const pending: Promise<string | null> =
      window.electronAPI
        .getAppVersion?.()
        .then((result) => result?.version ?? null)
        .catch((error) => {
          logger.error("Failed to read app version for workspace policy:", error);
          return null;
        }) ?? Promise.resolve(null);
    // An unknown version denies every managed action while hiding the update
    // banner that explains it, so never cache a failed read for the session.
    appVersionPromise = pending.then((version) => {
      if (!version) appVersionPromise = null;
      return version;
    });
  }
  return appVersionPromise;
}

function normalizeSnapshot(
  result: PolicyIpcSnapshot,
  current: PolicyState
): Required<
  Pick<PolicyIpcSnapshot, "revision" | "accountId" | "authGeneration" | "managed" | "policy">
> {
  return {
    revision: result.revision ?? current.revision + 1,
    // A mixed new-renderer/old-main response has no credential identity. It
    // must never inherit the renderer's requested account or generation,
    // because an older main may be returning a global cache from another user.
    accountId: result.accountId ?? null,
    authGeneration: result.authGeneration ?? null,
    managed: Boolean(result.managed),
    policy: result.policy ?? null,
  };
}

function applyPolicySnapshot(result: PolicyIpcSnapshot, appVersion: string | null): boolean {
  const current = usePolicyStore.getState();
  const snapshot = normalizeSnapshot(result, current);
  if (
    !current.accountId ||
    current.authGeneration == null ||
    snapshot.accountId !== current.accountId ||
    snapshot.authGeneration !== current.authGeneration ||
    !shouldAcceptPolicySnapshot(
      {
        accountId: current.accountId,
        authGeneration: current.authGeneration,
        revision: current.revision,
      },
      {
        accountId: snapshot.accountId,
        authGeneration: snapshot.authGeneration,
        revision: snapshot.revision,
      }
    )
  ) {
    return false;
  }

  if (snapshot.managed && !snapshot.policy) return false;
  usePolicyStore.setState({
    accountId: snapshot.accountId,
    authGeneration: snapshot.authGeneration,
    revision: snapshot.revision,
    status: snapshot.managed ? "managed" : "unmanaged",
    managed: snapshot.managed,
    policy: snapshot.policy,
    appVersion,
  });
  return true;
}

function applyPolicyFailure(result: PolicyIpcSnapshot): boolean {
  const current = usePolicyStore.getState();
  if (
    result.code !== "POLICY_UNRESOLVABLE" ||
    !current.accountId ||
    current.authGeneration == null ||
    result.accountId !== current.accountId ||
    result.authGeneration !== current.authGeneration
  ) {
    return false;
  }
  if (current.status === "managed") return true;
  usePolicyStore.setState({
    status: "error",
    managed: false,
    policy: null,
  });
  return true;
}

function ensurePolicyLifecycleListeners(): void {
  if (lifecycleListenersReady) return;
  lifecycleListenersReady = true;
  window.electronAPI.onWorkspacePolicyChanged?.((snapshot) => {
    if (!snapshot.success) {
      applyPolicyFailure(snapshot);
      return;
    }
    void readAppVersion().then((appVersion) => applyPolicySnapshot(snapshot, appVersion));
  });
  const refreshResolvedPolicy = (): void => {
    const state = usePolicyStore.getState();
    const identity = resolvedPolicyRefreshIdentity(state);
    if (!identity) return;
    void state.fetchPolicy(identity.accountId, identity.authGeneration);
  };
  window.addEventListener("online", refreshResolvedPolicy);
  window.addEventListener("focus", refreshResolvedPolicy);
  window.setInterval(refreshResolvedPolicy, POLICY_SUCCESS_REFRESH_MS);
}

export const usePolicyStore = create<PolicyState>()((set, _get) => {
  const resetPolicy = (): void => {
    fetchSequence += 1;
    fetchInFlight = null;
    set({
      accountId: "local-user",
      authGeneration: 1,
      revision: 1,
      status: "unmanaged",
      managed: false,
      policy: null,
      appVersion: null,
    });
  };

  return {
    accountId: "local-user",
    authGeneration: 1,
    revision: 1,
    status: "unmanaged",
    managed: false,
    policy: null,
    appVersion: null,
    fetchPolicy: async (): Promise<void> => {},
    clearPolicy: (): void => resetPolicy(),
    suspendPolicy: (): void => {},
  };
});
