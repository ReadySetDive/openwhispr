import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { PROMPTS_BY_LOCALE } from "./locales/prompts";
import { TRANSLATIONS_BY_LOCALE } from "./locales/translations";

export const SUPPORTED_UI_LANGUAGES = ["en"] as const;
export type UiLanguage = (typeof SUPPORTED_UI_LANGUAGES)[number];

export function normalizeUiLanguage(_language?: string | null): UiLanguage {
  return "en";
}

const resources = {
  en: {
    translation: TRANSLATIONS_BY_LOCALE.en,
    prompts: PROMPTS_BY_LOCALE.en,
  },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  ns: ["translation", "prompts"],
  defaultNS: "translation",
  interpolation: {
    escapeValue: false,
  },
  returnEmptyString: true,
  returnNull: false,
});

export default i18n;
