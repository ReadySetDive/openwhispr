import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedRequest, attachNetworkFilter } from "../../src/helpers/networkFilter.js";

test("local and internal protocols are allowed", () => {
  assert.equal(isAllowedRequest("file:///path/to/model.bin"), true);
  assert.equal(isAllowedRequest("data:image/png;base64,abc"), true);
  assert.equal(isAllowedRequest("blob:http://localhost:3000/uuid"), true);
  assert.equal(isAllowedRequest("devtools://devtools/bundled/inspector.html"), true);
});

test("loopback requests are allowed for all methods (local sidecars)", () => {
  assert.equal(isAllowedRequest("http://127.0.0.1:8080/inference", "POST"), true);
  assert.equal(isAllowedRequest("http://127.0.0.1:8080/health", "GET"), true);
  assert.equal(isAllowedRequest("http://localhost:5173", "GET"), true);
  assert.equal(isAllowedRequest("http://localhost:6333/collections", "POST"), true);
  assert.equal(isAllowedRequest("ws://127.0.0.1:8080", "GET"), true);
  assert.equal(isAllowedRequest("ws://localhost:5173", "GET"), true);
  assert.equal(isAllowedRequest("http://[::1]:8080/api", "GET"), true);
});

test("model hub downloads via GET are allowed", () => {
  // Hugging Face
  assert.equal(
    isAllowedRequest("https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin", "GET"),
    true
  );
  assert.equal(
    isAllowedRequest("https://cdn-lfs.hf.co/repos/ggerganov/whisper.cpp/ggml-base.bin", "GET"),
    true
  );
  assert.equal(
    isAllowedRequest("https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin", "HEAD"),
    true
  );

  // GitHub / GitHub User Content
  assert.equal(
    isAllowedRequest("https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.0/whisper.bin", "GET"),
    true
  );
  assert.equal(
    isAllowedRequest("https://raw.githubusercontent.com/ggerganov/whisper.cpp/master/models/download.sh", "GET"),
    true
  );
  assert.equal(
    isAllowedRequest("https://objects.githubusercontent.com/github-production-release-asset-2e65be/123", "GET"),
    true
  );
});

test("external POST, PUT, DELETE, PATCH are strictly blocked, even on whitelisted hosts", () => {
  assert.equal(isAllowedRequest("https://huggingface.co/api/models", "POST"), false);
  assert.equal(isAllowedRequest("https://github.com/api/v3", "POST"), false);
  assert.equal(isAllowedRequest("https://github.com/api/v3", "PUT"), false);
  assert.equal(isAllowedRequest("https://github.com/api/v3", "DELETE"), false);
});

test("openwhispr.com is strictly blocked for all methods and subdomains", () => {
  assert.equal(isAllowedRequest("https://openwhispr.com/api", "GET"), false);
  assert.equal(isAllowedRequest("https://api.openwhispr.com/v1/transcribe", "POST"), false);
  assert.equal(isAllowedRequest("https://auth.openwhispr.com/api/auth/get-session", "GET"), false);
  assert.equal(isAllowedRequest("https://notes.openwhispr.com/sync", "POST"), false);
});

test("third-party AI APIs and general websites are strictly blocked", () => {
  assert.equal(isAllowedRequest("https://api.openai.com/v1/chat/completions", "POST"), false);
  assert.equal(isAllowedRequest("https://api.deepgram.com/v1/listen", "POST"), false);
  assert.equal(isAllowedRequest("https://api.assemblyai.com/v2/transcript", "POST"), false);
  assert.equal(isAllowedRequest("https://api.mistral.ai/v1/chat/completions", "POST"), false);
  assert.equal(isAllowedRequest("https://google.com", "GET"), false);
  assert.equal(isAllowedRequest("https://telemetry.example.com/collect", "POST"), false);
});

test("attachNetworkFilter sets up webRequest handler on session", () => {
  let registeredListener = null;
  const mockSession = {
    webRequest: {
      onBeforeRequest: (listener) => {
        registeredListener = listener;
      },
    },
  };

  attachNetworkFilter(mockSession);
  assert.ok(registeredListener);

  let allowedResult = null;
  registeredListener(
    { url: "https://huggingface.co/model.bin", method: "GET" },
    (res) => { allowedResult = res; }
  );
  assert.deepEqual(allowedResult, { cancel: false });

  let blockedResult = null;
  registeredListener(
    { url: "https://api.openwhispr.com/analytics", method: "POST" },
    (res) => { blockedResult = res; }
  );
  assert.deepEqual(blockedResult, { cancel: true });
});

test("initNetworkFilter binds defaultSession and session-created", () => {
  const { initNetworkFilter } = require("../../src/helpers/networkFilter.js");
  let defaultRegistered = false;
  let eventHandler = null;

  const mockDefaultSession = {
    webRequest: {
      onBeforeRequest: () => {
        defaultRegistered = true;
      },
    },
  };

  const mockApp = {
    on: (evt, handler) => {
      if (evt === "session-created") {
        eventHandler = handler;
      }
    },
  };

  initNetworkFilter(mockApp, { defaultSession: mockDefaultSession });
  assert.equal(defaultRegistered, true);
  assert.ok(eventHandler);

  let partitionRegistered = false;
  const mockPartitionSession = {
    webRequest: {
      onBeforeRequest: () => {
        partitionRegistered = true;
      },
    },
  };
  eventHandler(mockPartitionSession);
  assert.equal(partitionRegistered, true);
});

