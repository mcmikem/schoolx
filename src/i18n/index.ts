import en from "./locales/en.json";

const translations: Record<string, Record<string, string>> = {
  en,
};

export function t(key: string, locale: string = "en"): string {
  return translations[locale]?.[key] ?? translations.en?.[key] ?? key;
}

export function tWithParams(
  key: string,
  params: Record<string, string>,
  locale: string = "en",
): string {
  let value = t(key, locale);
  for (const [paramKey, paramValue] of Object.entries(params)) {
    value = value.replace(`{${paramKey}}`, paramValue);
  }
  return value;
}

export { translations };
