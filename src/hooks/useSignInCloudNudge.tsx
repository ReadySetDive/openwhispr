import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ToastActionButton } from "../components/ui/Toast";
import { useToast } from "../components/ui/useToast";
import { selectPolicyEffectiveSettings, useSettingsStore } from "../stores/settingsStore";
import { SIGN_IN_PROMPTED_AT_KEY } from "../utils/requestSignIn";
import { decideSignInCloudNudge } from "../utils/signInCloudNudge";
import { usePolicySnapshot } from "./usePolicy";

/**
 * Tells a user who just signed in that OpenWhispr Cloud is available, once, without
 * switching anything: a post-sign-in cloud switch is what overrode Local for #2086.
 * The marker requestSignIn left behind survives the reload that sign-in goes through.
 */
export function useSignInCloudNudge(
  _isSignedIn: boolean,
  _onOpenTranscriptionSettings: () => void
): void {
  // Offline: cloud nudge disabled
}
