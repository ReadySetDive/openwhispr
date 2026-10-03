/**
 * Network Filter (The Iron Dome)
 *
 * Enforces zero outbound data and offline privacy:
 * 1. Allow: Loopback (127.0.0.1, localhost, ::1) and local protocols (file:, data:, blob:, devtools:, chrome:).
 * 2. Allow: HTTP GET/HEAD only to public open-source model repositories:
 *    - huggingface.co / *.hf.co / *.huggingface.co
 *    - github.com / *.github.com / githubusercontent.com / *.githubusercontent.com
 * 3. Block & Cancel: Everything else, including:
 *    - All external POST, PUT, PATCH, DELETE requests
 *    - All requests to *.openwhispr.com
 *    - All requests to third-party AI APIs or cloud endpoints
 */

const LOCAL_PROTOCOLS = new Set([
  "file:",
  "data:",
  "blob:",
  "devtools:",
  "chrome:",
  "chrome-extension:",
  "vscode-webview:",
]);

function isLoopbackHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

function isOpenWhisprHost(hostname) {
  return hostname === "openwhispr.com" || hostname.endsWith(".openwhispr.com");
}

function isWhitelistedModelHost(hostname) {
  // Hugging Face
  if (
    hostname === "huggingface.co" ||
    hostname.endsWith(".huggingface.co") ||
    hostname === "hf.co" ||
    hostname.endsWith(".hf.co")
  ) {
    return true;
  }

  // GitHub & GitHub User Content
  if (
    hostname === "github.com" ||
    hostname.endsWith(".github.com") ||
    hostname === "githubusercontent.com" ||
    hostname.endsWith(".githubusercontent.com")
  ) {
    return true;
  }

  return false;
}

/**
 * Validates whether an outgoing network request is permitted.
 * @param {string} urlString
 * @param {string} [method='GET']
 * @returns {boolean}
 */
function isAllowedRequest(urlString, method = "GET") {
  if (typeof urlString !== "string" || !urlString) {
    return false;
  }

  // Allow internal local protocols
  for (const proto of LOCAL_PROTOCOLS) {
    if (urlString.startsWith(proto)) {
      return true;
    }
  }

  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return false;
  }

  const protocol = parsed.protocol.toLowerCase();
  if (
    protocol !== "http:" &&
    protocol !== "https:" &&
    protocol !== "ws:" &&
    protocol !== "wss:"
  ) {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  const upperMethod = (method || "GET").toUpperCase();

  // Hard block any requests to openwhispr.com and subdomains
  if (isOpenWhisprHost(hostname)) {
    return false;
  }

  // Loopback traffic is allowed (for local sidecars: whisper-server, llama-server, qdrant, Vite HMR)
  if (isLoopbackHost(hostname)) {
    return true;
  }

  // External network traffic: MUST be GET or HEAD (Zero outbound data / Zero POSTs)
  if (upperMethod !== "GET" && upperMethod !== "HEAD") {
    return false;
  }

  // External network traffic: Whitelisted model hub hosts only
  if (isWhitelistedModelHost(hostname)) {
    return true;
  }

  // Everything else is blocked
  return false;
}

const filteredSessions = new WeakSet();

/**
 * Attaches the network filter to an Electron session instance.
 * @param {Electron.Session} targetSession
 * @param {object} [logger]
 */
function attachNetworkFilter(targetSession, logger = console) {
  if (!targetSession || typeof targetSession.webRequest?.onBeforeRequest !== "function") {
    return;
  }

  if (filteredSessions.has(targetSession)) {
    return;
  }
  filteredSessions.add(targetSession);

  targetSession.webRequest.onBeforeRequest((details, callback) => {
    const { url, method = "GET" } = details;
    const allowed = isAllowedRequest(url, method);

    if (allowed) {
      callback({ cancel: false });
    } else {
      if (logger && typeof logger.warn === "function") {
        logger.warn(`[NetworkFilter] Blocked outbound request: [${method}] ${url}`);
      }
      callback({ cancel: true });
    }
  });
}

/**
 * Initializes the network filter across the default session and all future session partitions.
 * @param {Electron.App} app
 * @param {Electron.Session} session
 * @param {object} [logger]
 */
function initNetworkFilter(app, session, logger = console) {
  if (session?.defaultSession) {
    attachNetworkFilter(session.defaultSession, logger);
  }

  if (app && typeof app.on === "function") {
    app.on("session-created", (newSession) => {
      attachNetworkFilter(newSession, logger);
    });
  }
}

module.exports = {
  isAllowedRequest,
  attachNetworkFilter,
  initNetworkFilter,
  isLoopbackHost,
  isOpenWhisprHost,
  isWhitelistedModelHost,
};
