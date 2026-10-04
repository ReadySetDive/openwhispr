/**
 * Utility to parse text-based tool calls emitted by models that stream tool
 * invocations as raw text tokens rather than OpenAI-style delta.tool_calls.
 * 
 * Supports:
 * - Google Gemma 4: <|tool_call>call:tool_name{key:value}<tool_call|>
 * - Qwen / ChatML XML: <tool_call>{"name": "tool_name", "arguments": {...}}</tool_call>
 * - Markdown JSON blocks: ```json {"name": "...", "arguments": {...}} ```
 * - Action / Action Input patterns
 * - Direct call syntax: call:tool_name{key:value}
 */

export interface ParsedTextToolCall {
  toolName: string;
  arguments: Record<string, unknown>;
  rawCallText: string;
  cleanText: string;
}

/**
 * Attempts to parse loose JSON strings that may have unquoted keys,
 * single-quoted values, or trailing commas.
 */
export function parseLooseJson(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Try standard JSON parse first
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {}

  // Attempt normalizing relaxed JS object notation:
  // 1. Wrap unquoted keys in double quotes
  // 2. Replace single quotes with double quotes
  try {
    let normalized = trimmed
      // Replace single-quoted string literals with double-quoted
      .replace(/'((?:\\.|[^'\\])*)'/g, (_, inner) => JSON.stringify(inner))
      // Add quotes to unquoted object keys: { key: "value" } -> { "key": "value" }
      .replace(/([{,]\s*)([a-zA-Z0-9_$-]+)\s*:/g, '$1"$2":')
      // Remove trailing commas in objects: { "a": 1, } -> { "a": 1 }
      .replace(/,\s*([}\]])/g, "$1");

    // If string doesn't start with '{', wrap in braces if it looks like key-values
    if (!normalized.startsWith("{") && normalized.includes(":")) {
      normalized = `{${normalized}}`;
    }

    const parsed = JSON.parse(normalized);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {}

  // Fallback for simple key: "value" or key: 'value' extraction
  const simpleMatch = trimmed.match(/([a-zA-Z0-9_]+)\s*[:=]\s*["']?([^"',}\n]+)["']?/);
  if (simpleMatch) {
    return { [simpleMatch[1]]: simpleMatch[2].trim() };
  }

  // If input was a bare string without keys and looks like a query or URL (e.g. {"foo"} or "foo")
  const bareStrMatch = trimmed.match(/^\{?\s*["']?([^"'{}\n]+)["']?\s*\}?$/);
  if (bareStrMatch && bareStrMatch[1].trim()) {
    const val = bareStrMatch[1].trim();
    if (val.startsWith("http://") || val.startsWith("https://")) {
      return { url: val };
    }
    return { query: val };
  }

  return null;
}

/**
 * Inspects assistant response text for tool call patterns.
 * If knownToolNames is provided, only matches calls targeting one of those tools.
 */
export function parseTextToolCall(
  text: string,
  knownToolNames?: readonly string[]
): ParsedTextToolCall | null {
  if (!text || typeof text !== "string") return null;

  const isAllowedTool = (name: string): boolean => {
    if (!name) return false;
    if (!knownToolNames || knownToolNames.length === 0) return true;
    const lower = name.toLowerCase().trim();
    return knownToolNames.some((t) => t.toLowerCase().trim() === lower);
  };

  // 1. Google Gemma 4 syntax:
  // <|tool_call>call:tool_name{key: "val"}<tool_call|>
  // or <|tool_call>call:tool_name(key="val")<tool_call|>
  const gemmaRegex = /<\|tool_call>call:([a-zA-Z0-9_]+)\s*(?:\{([\s\S]*?)\}|\(([\s\S]*?)\))<tool_call\|>/i;
  const gemmaMatch = text.match(gemmaRegex);
  if (gemmaMatch) {
    const toolName = gemmaMatch[1];
    if (isAllowedTool(toolName)) {
      const argsRaw = gemmaMatch[2] !== undefined ? `{${gemmaMatch[2]}}` : `{${gemmaMatch[3]}}`;
      const args = parseLooseJson(argsRaw) || (gemmaMatch[2] ? { query: gemmaMatch[2].trim() } : {});
      return {
        toolName,
        arguments: args,
        rawCallText: gemmaMatch[0],
        cleanText: text.replace(gemmaMatch[0], "").trim(),
      };
    }
  }

  // 2. XML tag syntax: <tool_call>...</tool_call>
  const xmlRegex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/i;
  const xmlMatch = text.match(xmlRegex);
  if (xmlMatch) {
    const rawBody = xmlMatch[1].trim();
    // Check if body is "call:tool_name{...}"
    const callPrefixMatch = rawBody.match(/^call:([a-zA-Z0-9_]+)\s*\{([\s\S]*)\}$/i);
    if (callPrefixMatch) {
      const toolName = callPrefixMatch[1];
      if (isAllowedTool(toolName)) {
        const args = parseLooseJson(`{${callPrefixMatch[2]}}`) || {};
        return {
          toolName,
          arguments: args,
          rawCallText: xmlMatch[0],
          cleanText: text.replace(xmlMatch[0], "").trim(),
        };
      }
    }

    // Try parsing body as JSON object
    const parsed = parseLooseJson(rawBody);
    if (parsed) {
      const toolName =
        (typeof parsed.name === "string" ? parsed.name : null) ||
        (typeof parsed.tool === "string" ? parsed.tool : null) ||
        (typeof parsed.tool_name === "string" ? parsed.tool_name : null);

      if (toolName && isAllowedTool(toolName)) {
        let args: Record<string, unknown> = {};
        if (parsed.arguments && typeof parsed.arguments === "object") {
          args = parsed.arguments as Record<string, unknown>;
        } else if (parsed.parameters && typeof parsed.parameters === "object") {
          args = parsed.parameters as Record<string, unknown>;
        } else {
          // Flatten: exclude tool/name keys
          const { name: _n, tool: _t, tool_name: _tn, ...rest } = parsed;
          args = rest;
        }
        return {
          toolName,
          arguments: args,
          rawCallText: xmlMatch[0],
          cleanText: text.replace(xmlMatch[0], "").trim(),
        };
      }
    }
  }

  // 3. Markdown code block with JSON tool call:
  // ```json
  // { "name": "web_search", "arguments": { ... } }
  // ```
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const codeBlockMatch = text.match(codeBlockRegex);
  if (codeBlockMatch) {
    const blockContent = codeBlockMatch[1].trim();
    const parsed = parseLooseJson(blockContent);
    if (parsed) {
      const toolName =
        (typeof parsed.name === "string" ? parsed.name : null) ||
        (typeof parsed.tool === "string" ? parsed.tool : null);

      if (toolName && isAllowedTool(toolName)) {
        let args: Record<string, unknown> = {};
        if (parsed.arguments && typeof parsed.arguments === "object") {
          args = parsed.arguments as Record<string, unknown>;
        } else if (parsed.parameters && typeof parsed.parameters === "object") {
          args = parsed.parameters as Record<string, unknown>;
        } else {
          const { name: _n, tool: _t, ...rest } = parsed;
          args = rest;
        }
        return {
          toolName,
          arguments: args,
          rawCallText: codeBlockMatch[0],
          cleanText: text.replace(codeBlockMatch[0], "").trim(),
        };
      }
    }
  }

  // 4. Action / Action Input pattern
  const actionRegex = /Action:\s*([a-zA-Z0-9_]+)\s*\nAction Input:\s*([\s\S]*?)(?:\n\n|$)/i;
  const actionMatch = text.match(actionRegex);
  if (actionMatch) {
    const toolName = actionMatch[1];
    if (isAllowedTool(toolName)) {
      const inputStr = actionMatch[2].trim();
      const args = parseLooseJson(inputStr) || { query: inputStr };
      return {
        toolName,
        arguments: args,
        rawCallText: actionMatch[0],
        cleanText: text.replace(actionMatch[0], "").trim(),
      };
    }
  }

  // 5. Bare call:tool_name{...}
  const bareCallRegex = /\bcall:([a-zA-Z0-9_]+)\s*\{([\s\S]*?)\}/i;
  const bareCallMatch = text.match(bareCallRegex);
  if (bareCallMatch) {
    const toolName = bareCallMatch[1];
    if (isAllowedTool(toolName)) {
      const args = parseLooseJson(`{${bareCallMatch[2]}}`) || {};
      return {
        toolName,
        arguments: args,
        rawCallText: bareCallMatch[0],
        cleanText: text.replace(bareCallMatch[0], "").trim(),
      };
    }
  }

  return null;
}

/**
 * Strips raw tool call syntax/tags from text so unparsed or malformed tool call
 * markup never leaks into user-facing chat responses.
 */
export function stripToolCallTags(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/<\|tool_call>[\s\S]*?<tool_call\|>/gi, "")
    .replace(/```(?:json)?\s*\{\s*["'](?:name|tool)["']\s*:\s*["'][a-zA-Z0-9_]+["'][\s\S]*?\}\s*```/gi, "")
    .trim();
}

