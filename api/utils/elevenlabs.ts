import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { SupportedLanguages } from "../entities/users";
import { translateText } from "./translate";

// Map app languages to ElevenLabs language codes
const ELEVENLABS_LANGUAGE_MAP: Record<SupportedLanguages, string> = {
  [SupportedLanguages.ENGLISH]: "en",
  [SupportedLanguages.HINDI]: "hi",
  [SupportedLanguages.MARATHI]: "mr",
};

// Voice IDs — you can change these to preferred voices
const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // George (multilingual)

let client: ElevenLabsClient | null = null;

function getClient(): ElevenLabsClient {
  if (!client) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY is not set in environment variables");
    }
    client = new ElevenLabsClient({ apiKey });
  }
  return client;
}

/**
 * Converts text to speech using ElevenLabs multilingual model.
 * The text should already be in the target language.
 *
 * @param text - The text to convert to speech (in target language)
 * @param language - Target language for pronunciation hints
 * @param voiceId - Optional ElevenLabs voice ID (defaults to George)
 * @returns Audio buffer in MP3 format
 */
export async function textToSpeech(
  text: string,
  language: SupportedLanguages = SupportedLanguages.ENGLISH,
  voiceId: string = DEFAULT_VOICE_ID
): Promise<Buffer> {
  const elevenlabs = getClient();
  const langCode = ELEVENLABS_LANGUAGE_MAP[language];

  console.log(
    `[ElevenLabs] Generating audio for language=${langCode}, text="${text.substring(0, 50)}..."`
  );

  const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
    text,
    modelId: "eleven_multilingual_v2",
    outputFormat: "mp3_44100_128",
    languageCode: langCode,
  });

  // Collect stream into a single buffer
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

/**
 * Translates English text to the target language and generates audio.
 * Combines translation + TTS in a single call.
 *
 * @param englishText - The English text to translate and convert
 * @param targetLanguage - The language to translate to and generate audio in
 * @param voiceId - Optional ElevenLabs voice ID
 * @returns Object with translatedText and audioBuffer
 */
export async function translateAndSpeak(
  englishText: string,
  targetLanguage: SupportedLanguages,
  voiceId?: string
): Promise<{ translatedText: string; audioBuffer: Buffer }> {
  // If target is English, skip translation
  let translatedText = englishText;
  if (targetLanguage !== SupportedLanguages.ENGLISH) {
    translatedText = await translateText(englishText, targetLanguage);
  }

  const audioBuffer = await textToSpeech(translatedText, targetLanguage, voiceId);

  return { translatedText, audioBuffer };
}
