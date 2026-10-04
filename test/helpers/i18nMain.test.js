const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { normalizeUiLanguage, SUPPORTED_UI_LANGUAGES } = require("../../src/helpers/i18nMain");

describe("normalizeUiLanguage", () => {
  it("only supports English", () => {
    assert.deepEqual(SUPPORTED_UI_LANGUAGES, ["en"]);
  });

  it("normalizes all languages to English", () => {
    assert.equal(normalizeUiLanguage("en"), "en");
    assert.equal(normalizeUiLanguage("en-US"), "en");
    assert.equal(normalizeUiLanguage("zh-CN"), "en");
    assert.equal(normalizeUiLanguage("es"), "en");
    assert.equal(normalizeUiLanguage("ko-KR"), "en");
    assert.equal(normalizeUiLanguage(""), "en");
    assert.equal(normalizeUiLanguage(null), "en");
  });
});
