import test from "node:test";
import assert from "node:assert/strict";
import {
  unescapeHtml,
  isNewsQuery,
  searchDuckDuckGo,
} from "../../src/helpers/duckduckgoSearch.js";

test("isNewsQuery: correctly identifies queries requesting current news or headlines", () => {
  assert.equal(isNewsQuery("current news headlines"), true);
  assert.equal(isNewsQuery("top news today"), true);
  assert.equal(isNewsQuery("breaking headlines"), true);
  assert.equal(isNewsQuery("latest updates on economy"), true);
  assert.equal(isNewsQuery("who is Sam Altman"), false);
  assert.equal(isNewsQuery("how to sort an array in python"), false);
});

test("unescapeHtml: cleans HTML entities and tags", () => {
  assert.equal(
    unescapeHtml("U.S. &amp; World News &lt;b&gt;Headlines&lt;/b&gt;"),
    "U.S. & World News Headlines"
  );
  assert.equal(
    unescapeHtml("Supreme Court&#x27;s new term"),
    "Supreme Court's new term"
  );
});

test("searchDuckDuckGo: handles empty or invalid queries gracefully", async () => {
  const empty = await searchDuckDuckGo("");
  assert.deepEqual(empty, []);

  const nil = await searchDuckDuckGo(null);
  assert.deepEqual(nil, []);
});
