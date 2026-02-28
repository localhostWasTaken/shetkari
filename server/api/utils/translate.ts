import { translate } from "@vitalets/google-translate-api";
import { SupportedLanguages } from "../entities/users";

const GOOGLE_TRANSLATE_LANG_MAP: Record<SupportedLanguages, string> = {
  [SupportedLanguages.ENGLISH]: "en",
  [SupportedLanguages.HINDI]: "hi",
  [SupportedLanguages.MARATHI]: "mr",
};

export async function translateText(
  text: string,
  targetLanguage: SupportedLanguages
): Promise<string> {
  if (targetLanguage === SupportedLanguages.ENGLISH) {
    return text;
  }

  const targetLangCode = GOOGLE_TRANSLATE_LANG_MAP[targetLanguage];

  console.log(
    `[Translate] Translating to ${targetLangCode}: "${text.substring(0, 50)}..."`
  );

  const result = await translate(text, {
    from: "en",
    to: targetLangCode,
  });

  console.log(
    `[Translate] Result: "${result.text.substring(0, 50)}..."`
  );

  return result.text;
}
