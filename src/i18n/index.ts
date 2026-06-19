import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import ko from "./ko.json";

export const SUPPORTED_LANGS = ["en", "ko"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];
export const LANG_STORAGE_KEY = "oc_lang";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ko: { translation: ko },
    },
    fallbackLng: "en",
    supportedLngs: [...SUPPORTED_LANGS],
    nonExplicitSupportedLngs: true, // ko-KR -> ko
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: LANG_STORAGE_KEY,
    },
  });

export default i18n;
