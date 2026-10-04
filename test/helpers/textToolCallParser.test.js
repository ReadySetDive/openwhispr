import test from "node:test";
import assert from "node:assert/strict";
import {
  parseTextToolCall,
  parseLooseJson,
  stripToolCallTags,
} from "../../src/helpers/textToolCallParser.ts";

test("parseTextToolCall: parses XML tool call tag embedded inside explanatory text", () => {
  const text =
    'I apologize for the confusion. Let me search for the top stories right now to give you a summary.\n' +
    '<tool_call> {"name": "web_search", "arguments": {"query": "top current news headlines today"}} </tool_call>';

  const result = parseTextToolCall(text, ["web_search", "fetch_web_page"]);
  assert.ok(result, "Should parse tool call successfully");
  assert.equal(result.toolName, "web_search");
  assert.deepEqual(result.arguments, { query: "top current news headlines today" });
  assert.equal(
    result.cleanText,
    "I apologize for the confusion. Let me search for the top stories right now to give you a summary."
  );
});

test("parseTextToolCall: parses standard loose JSON formats", () => {
  const json = parseLooseJson('{ "name": "web_search", "arguments": { "query": "hello world" } }');
  assert.ok(json);
  assert.equal(json.name, "web_search");
});

test("stripToolCallTags: strips raw tool call tags from message content", () => {
  const raw =
    'Here is some text\n<tool_call> {"name": "web_search", "arguments": {"query": "news"}} </tool_call>\nFinal text';
  const stripped = stripToolCallTags(raw);
  assert.equal(stripped, "Here is some text\n\nFinal text");
});
