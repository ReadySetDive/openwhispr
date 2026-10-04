import { getLocalModel, getCloudModel } from "../models/ModelRegistry";
import type { Message } from "../components/chat/types";

/**
 * Fast estimation of tokens for a given string (~3.5 characters per token).
 */
export function estimateTokens(text: string): number {
  if (typeof text !== "string" || text.length === 0) return 0;

  let cjkCount = 0;
  let otherCount = 0;
  for (const character of text) {
    const cp = character.codePointAt(0) || 0;
    if (
      (cp >= 0x1100 && cp <= 0x11ff) ||
      (cp >= 0x3000 && cp <= 0x303f) ||
      (cp >= 0x3040 && cp <= 0x30ff) ||
      (cp >= 0x3400 && cp <= 0x4dbf) ||
      (cp >= 0x4e00 && cp <= 0x9fff) ||
      (cp >= 0xac00 && cp <= 0xd7af) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xff00 && cp <= 0xffef) ||
      (cp >= 0x20000 && cp <= 0x3ffff)
    ) {
      cjkCount += 1;
    } else {
      otherCount += 1;
    }
  }

  return cjkCount + Math.ceil(otherCount / 3.5);
}

/**
 * Estimates token usage for a single chat message, including content and tool calls.
 */
export function estimateMessageTokens(message: Message): number {
  let count = 0;
  if (typeof message.content === "string") {
    count += estimateTokens(message.content);
  }
  if (message.toolCalls && message.toolCalls.length > 0) {
    for (const tc of message.toolCalls) {
      count += estimateTokens(tc.name);
      if (tc.arguments) count += estimateTokens(tc.arguments);
      if (tc.result) count += estimateTokens(tc.result);
    }
  }
  return count;
}

/**
 * Estimates total active conversation tokens (system prompt overhead + messages in history).
 */
export function estimateConversationTokens(
  messages: Message[],
  systemPromptBaseTokens = 450
): number {
  let total = systemPromptBaseTokens;
  for (const m of messages) {
    total += estimateMessageTokens(m);
  }
  return total;
}

/**
 * Formats a token number to 2 significant figures.
 * E.g.:
 * 6100 -> "6.1k"
 * 8000 -> "8k"
 * 8192 -> "8k"
 * 16384 -> "16k"
 * 32768 -> "32k"
 * 128000 -> "130k"
 * 1000000 -> "1M"
 * 520 -> "520"
 * 45 -> "45"
 */
export function formatTokensSigFigs(tokens: number): string {
  if (tokens <= 0) return "0";

  // Check known standard binary powers of 2 for clean display
  const standardContexts: Record<number, string> = {
    4096: "4k",
    8192: "8k",
    16384: "16k",
    32768: "32k",
    65536: "64k",
    131072: "128k",
    262144: "256k",
    524288: "512k",
    1048576: "1M",
  };

  for (const [sizeStr, label] of Object.entries(standardContexts)) {
    const size = Number(sizeStr);
    if (Math.abs(tokens - size) <= size * 0.02) {
      return label;
    }
  }

  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    return m < 10 ? `${parseFloat(m.toPrecision(2))}M` : `${Math.round(m)}M`;
  }

  if (tokens >= 1000) {
    const k = tokens / 1000;
    if (k < 10) {
      const rounded = parseFloat(k.toPrecision(2));
      return `${rounded}k`;
    }
    const order = Math.pow(10, Math.floor(Math.log10(k)) - 1);
    const rounded = Math.round(k / order) * order;
    return `${rounded}k`;
  }

  if (tokens >= 100) {
    return String(Math.round(tokens / 10) * 10);
  }

  return String(Math.round(tokens));
}

/**
 * Resolves the context window limit for the given model and environment.
 */
export function resolveModelContextLimit(
  modelId: string,
  providerId?: string,
  mode?: string,
  serverContextSize?: number
): number {
  const isLocal = mode === "local" || providerId === "local";

  if (isLocal && serverContextSize && serverContextSize > 0) {
    return serverContextSize;
  }

  if (isLocal) {
    const localModel = getLocalModel(modelId);
    if (localModel?.contextLength) {
      return localModel.contextLength;
    }
    if (/gemma-4/i.test(modelId)) return 8192;
    if (/qwen/i.test(modelId)) return 32768;
    return 8192;
  }

  // Cloud models
  const cloudModel = getCloudModel(modelId, providerId);
  if (providerId === "anthropic") return 200_000;
  if (providerId === "gemini") return 1_000_000;
  if (providerId === "openai") return 128_000;
  if (providerId === "groq") return 128_000;

  return 128_000;
}
