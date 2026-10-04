const i18next = require("i18next");

const enTranslation = require("../locales/en/translation.json");
const enPrompts = require("../locales/en/prompts.json");

const SUPPORTED_UI_LANGUAGES = ["en"];

function normalizeUiLanguage(_language) {
  return "en";
}

const i18nMain = i18next.createInstance();

void i18nMain.init({
  initAsync: false,
  resources: {
    en: {
      translation: enTranslation,
      prompts: enPrompts,
    },
  },
  lng: "en",
  fallbackLng: "en",
  ns: ["translation", "prompts"],
  defaultNS: "translation",
  interpolation: {
    escapeValue: false,
  },
  returnEmptyString: false,
  returnNull: false,
});

function changeLanguage(_language) {
  return "en";
}

module.exports = {
  i18nMain,
  changeLanguage,
  normalizeUiLanguage,
  SUPPORTED_UI_LANGUAGES,
};
