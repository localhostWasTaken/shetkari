import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { SupportedLanguages } from "../entities/users";
import { translateText } from "./translate";

const ELEVENLABS_LANGUAGE_MAP: Record<SupportedLanguages, string> = {
  [SupportedLanguages.ENGLISH]: "en",
  [SupportedLanguages.HINDI]: "hi",
  [SupportedLanguages.MARATHI]: "mr",
};

const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

export async function textToSpeech(
  text: string,
  language: SupportedLanguages = SupportedLanguages.ENGLISH,
  voiceId: string = DEFAULT_VOICE_ID
): Promise<Buffer> {
  const elevenlabsClient = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
  const langCode = ELEVENLABS_LANGUAGE_MAP[language];

  console.log(
    `[ElevenLabs] Generating audio for language=${langCode}, text="${text.substring(0, 50)}..."`
  );

  const audioStream = await elevenlabsClient.textToSpeech.convert(voiceId, {
    text,
    modelId: "eleven_multilingual_v2",
    outputFormat: "mp3_44100_128",
    languageCode: langCode,
  });

  const chunks: Buffer[] = [];
  for await (const chunk of audioStream) {
    chunks.push(Buffer.from(chunk));
  }

  const audioBuffer = Buffer.concat(chunks);
  console.log(
    `[ElevenLabs] Audio generated: ${audioBuffer.length} bytes`
  );

  return audioBuffer;
}

export async function translateAndSpeak(
  englishText: string,
  targetLanguage: SupportedLanguages,
  voiceId?: string
): Promise<{ translatedText: string; audioBuffer: Buffer }> {

  let translatedText = englishText;
  if (targetLanguage !== SupportedLanguages.ENGLISH) {
    translatedText = await translateText(englishText, targetLanguage);
  }

  const audioBuffer = await textToSpeech(translatedText, targetLanguage, voiceId);

  return { translatedText, audioBuffer };
}