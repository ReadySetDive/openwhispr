const AUTH_REQUEST_GENERATION = "openWhisprAuthGeneration";

export interface AuthTokenState {
  token: string | null;
  generation: number;
}

export interface AuthTokenStateEvent {
  generation: number;
  hasToken: boolean;
}

export interface RendererAuthContextSnapshot {
  revision: number;
  observedGeneration: number | null;
  hasToken: boolean;
  sessionResolved: boolean;
  sessionGeneration: number | null;
  sessionUserId: string | null;
  validatedGeneration: number | null;
}

type AuthRequest = {
  url?: URL | string;
  headers?: Headers | Record<string, string>;
  credentials?: RequestCredentials;
  [AUTH_REQUEST_GENERATION]?: number;
};

type AuthSuccessContext = {
  data?: unknown;
  response: Response;
  request: AuthRequest;
};

let snapshot: RendererAuthContextSnapshot = {
  revision: 0,
  observedGeneration: null,
  hasToken: false,
  sessionResolved: false,
  sessionGeneration: null,
  sessionUserId: null,
  validatedGeneration: null,
};
const subscribers = new Set<() => void>();

function publish(next: Omit<RendererAuthContextSnapshot, "revision">): void {
  snapshot = { ...next, revision: snapshot.revision + 1 };
  subscribers.forEach((subscriber) => subscriber());
}

function update(
  updater: (current: RendererAuthContextSnapshot) => Omit<RendererAuthContextSnapshot, "revision">
): void {
  const next = updater(snapshot);
  const comparableCurrent = { ...snapshot, revision: 0 };
  const comparableNext = { ...next, revision: 0 };
  if (JSON.stringify(comparableCurrent) === JSON.stringify(comparableNext)) return;
  publish(next);
}

function validGeneration(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function observeState(generation: number, hasToken: boolean): void {
  if (!validGeneration(generation)) return;
  update((current) => {
    const generationChanged = current.observedGeneration !== generation;
    const dropSession = generationChanged && current.sessionGeneration !== generation;
    const dropValidated = generationChanged && current.validatedGeneration !== generation;
    return {
      ...current,
      observedGeneration: generation,
      hasToken,
      sessionResolved: dropSession ? false : current.sessionResolved,
      sessionGeneration: dropSession ? null : current.sessionGeneration,
      sessionUserId: dropSession ? null : current.sessionUserId,
      validatedGeneration: dropValidated ? null : current.validatedGeneration,
    };
  });
}

export function observeAuthTokenState(state: AuthTokenState): void {
  observeState(state.generation, Boolean(state.token));
}

export function observeAuthTokenStateEvent(state: AuthTokenStateEvent): void {
  observeState(state.generation, state.hasToken);
}

export function subscribeAuthRequestContext(onChange: () => void): () => void {
  subscribers.add(onChange);
  return () => subscribers.delete(onChange);
}

export function getAuthRequestContextSnapshot(): RendererAuthContextSnapshot {
  return snapshot;
}

export function getAuthRequestContextServerSnapshot(): RendererAuthContextSnapshot {
  return snapshot;
}

export async function readAuthTokenState(): Promise<AuthTokenState> {
  const state = await window.electronAPI?.authGetTokenState?.();
  if (!state || !validGeneration(state.generation)) {
    throw Object.assign(new Error("Authentication token state is unavailable"), {
      code: "AUTH_CONTEXT_UNVALIDATED",
    });
  }
  const normalized = {
    token: typeof state.token === "string" && state.token ? state.token : null,
    generation: state.generation,
  };
  observeAuthTokenState(normalized);
  return normalized;
}

function requestGeneration(request: AuthRequest | RequestInit | undefined): number {
  const generation = (request as AuthRequest | undefined)?.[AUTH_REQUEST_GENERATION];
  if (!validGeneration(generation)) {
    throw Object.assign(new Error("Authentication request has no credential generation"), {
      code: "AUTH_CONTEXT_UNVALIDATED",
    });
  }
  return generation;
}

function requestAuthorization(request: AuthRequest | RequestInit | undefined): string | null {
  const headers = new Headers(request?.headers);
  return headers.get("Authorization");
}

export async function assertAuthRequestCurrent(
  request: AuthRequest | RequestInit | undefined
): Promise<AuthTokenState> {
  const expectedGeneration = requestGeneration(request);
  const state = await readAuthTokenState();
  const expectedAuthorization = state.token ? `Bearer ${state.token}` : null;
  if (
    state.generation !== expectedGeneration ||
    requestAuthorization(request) !== expectedAuthorization
  ) {
    throw Object.assign(new Error("Authentication context changed during request"), {
      code: "AUTH_CONTEXT_CHANGED",
    });
  }
  return state;
}

export async function prepareAuthRequest<T extends AuthRequest>(request: T): Promise<T> {
  const state = await readAuthTokenState();
  const headers = new Headers(request.headers);
  headers.delete("Cookie");
  if (state.token) headers.set("Authorization", `Bearer ${state.token}`);
  else headers.delete("Authorization");
  return Object.assign(request, {
    headers,
    credentials: "omit" as RequestCredentials,
    [AUTH_REQUEST_GENERATION]: state.generation,
  });
}

export async function authContextFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const urlStr = String(input);
  if (urlStr.includes("get-session") || isGetSessionRequest((init ?? {}) as AuthRequest)) {
    const mockData = {
      user: {
        id: "local-user",
        name: "Local User",
        email: "local@offline",
        emailVerified: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      session: {
        id: "local-session",
        userId: "local-user",
        expiresAt: "2099-01-01T00:00:00.000Z",
        token: "local-offline-token",
      },
    };
    return new Response(JSON.stringify(mockData), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function isGetSessionRequest(request: AuthRequest): boolean {
  try {
    const path = new URL(String(request.url), window.location.origin).pathname;
    return path.endsWith("/get-session");
  } catch {
    return false;
  }
}

function resolvedUserId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const user = (data as { user?: unknown }).user;
  if (!user || typeof user !== "object") return null;
  const id = (user as { id?: unknown }).id;
  return typeof id === "string" ? id : null;
}

function recordSessionResolution(generation: number, userId: string | null): void {
  update((current) => ({
    ...current,
    sessionResolved: true,
    sessionGeneration: generation,
    sessionUserId: userId,
    // A stable refresh for the same user may keep its validated lease. A null
    // or changed-user response stops sync immediately, including while
    // destructive cleanup waits out the grace period.
    validatedGeneration:
      userId &&
      current.sessionResolved &&
      current.sessionUserId === userId &&
      current.sessionGeneration === generation
        ? current.validatedGeneration
        : null,
  }));
}

function clearSessionResolutionFor(generation: number): void {
  update((current) => {
    if (current.sessionGeneration !== generation) return current;
    return {
      ...current,
      sessionResolved: false,
      sessionGeneration: null,
      sessionUserId: null,
      validatedGeneration: null,
    };
  });
}

export async function handleAuthRequestResponse(context: { request: AuthRequest }): Promise<void> {
  await assertAuthRequestCurrent(context.request);
}

export async function handleAuthRequestSuccess(context: AuthSuccessContext): Promise<void> {
  const requestState = await assertAuthRequestCurrent(context.request);
  let resolvedState = requestState;
  const rotatedToken = context.response.headers.get("set-auth-token");
  if (rotatedToken) {
    const result = await window.electronAPI?.authSetToken?.(rotatedToken, requestState.generation);
    if (!result?.success || !validGeneration(result.generation)) {
      throw Object.assign(new Error("Authentication token changed before rotation completed"), {
        code: result?.code ?? "AUTH_CONTEXT_CHANGED",
      });
    }
    resolvedState = {
      token: typeof result.token === "string" && result.token ? result.token : null,
      generation: result.generation,
    };
    observeAuthTokenState(resolvedState);
  }
  const current = await readAuthTokenState();
  if (current.generation !== resolvedState.generation || current.token !== resolvedState.token) {
    throw Object.assign(new Error("Authentication context changed after response"), {
      code: "AUTH_CONTEXT_CHANGED",
    });
  }
  if (isGetSessionRequest(context.request)) {
    recordSessionResolution(current.generation, resolvedUserId(context.data));
  }
}

export async function handleAuthRequestError(context: { request: AuthRequest }): Promise<void> {
  const generation = requestGeneration(context.request);
  await assertAuthRequestCurrent(context.request);
  if (isGetSessionRequest(context.request)) clearSessionResolutionFor(generation);
}

export function getBoundSessionGeneration(userId: string | null): number | null {
  if (
    !snapshot.sessionResolved ||
    snapshot.sessionGeneration == null ||
    snapshot.sessionGeneration !== snapshot.observedGeneration ||
    snapshot.sessionUserId !== userId
  ) {
    return null;
  }
  if (userId && !snapshot.hasToken) return null;
  return snapshot.sessionGeneration;
}

export function commitValidatedAuthContext(generation: number, userId: string): boolean {
  if (
    !validGeneration(generation) ||
    !userId ||
    getBoundSessionGeneration(userId) !== generation ||
    !snapshot.hasToken
  ) {
    return false;
  }
  update((current) => ({ ...current, validatedGeneration: generation }));
  return true;
}

export function invalidateValidatedAuthContext(): void {
  update((current) => ({ ...current, validatedGeneration: null }));
}

export function getValidatedAuthGeneration(): number | null {
  return snapshot.validatedGeneration === snapshot.observedGeneration && snapshot.hasToken
    ? snapshot.validatedGeneration
    : null;
}

export function hasValidatedAuthContext(): boolean {
  return getValidatedAuthGeneration() != null;
}

export async function assertAuthGenerationCurrent(generation: number): Promise<void> {
  const state = await readAuthTokenState();
  if (state.generation !== generation || !state.token) {
    throw Object.assign(new Error("Authentication context changed during reconciliation"), {
      code: "AUTH_CONTEXT_CHANGED",
    });
  }
}

export function resetAuthRequestContextForTests(): void {
  snapshot = {
    revision: snapshot.revision + 1,
    observedGeneration: null,
    hasToken: false,
    sessionResolved: false,
    sessionGeneration: null,
    sessionUserId: null,
    validatedGeneration: null,
  };
}
