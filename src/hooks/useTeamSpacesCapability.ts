/**
 * Team spaces capability hook.
 * In local/individual mode, team spaces are disabled.
 */
export function useTeamSpacesCapability(_isSignedIn: boolean): boolean {
  return false;
}
