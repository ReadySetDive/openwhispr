export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  image?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const LOCAL_USER: AuthUser = {
  id: "local-user",
  name: "Local User",
  email: "local@offline",
  emailVerified: true,
  image: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

export const LOCAL_SESSION = {
  id: "local-session",
  userId: "local-user",
  user: LOCAL_USER,
  expiresAt: "2099-01-01T00:00:00.000Z",
  token: "local-offline-token",
};

export function useAuth() {
  return {
    isSignedIn: true,
    isAuthenticated: true,
    isGracePeriodOnly: false,
    isLoaded: true,
    session: LOCAL_SESSION,
    user: LOCAL_USER,
    isPro: true,
    refetch: async () => LOCAL_SESSION,
  };
}
