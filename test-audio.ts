import 'dotenv/config';
import { translateAndSpeak } from "./api/utils/elevenlabs";
import { SupportedLanguages } from "./api/entities/users";
import fs from "fs";

async function testAudio() {
  console.log("Testing ElevenLabs translation and TTS...\n");

  const testCases = [
    {
      text: "Your soil moisture is optimal for planting",
      language: SupportedLanguages.HINDI,
    },
    {
      text: "Mandi prices have increased this week",
      language: SupportedLanguages.MARATHI,
    },
    {
      text: "Check your crop health report",
      language: SupportedLanguages.ENGLISH,
    },
  ];

  for (const testCase of testCases) {
    try {
      console.log(`Testing: "${testCase.text}" → ${testCase.language}`);
      const { translatedText, audioBuffer } = await translateAndSpeak(
        testCase.text,
        testCase.language
      );

      console.log(`  ✓ Translated: "${translatedText}"`);
      console.log(`  ✓ Audio generated: ${audioBuffer.length} bytes\n`);

      // Save audio file locally for manual testing
      const filename = `test_${testCase.language}.mp3`;
      fs.writeFileSync(filename, audioBuffer);
      console.log(`  ✓ Saved to ${filename}\n`);
    } catch (error) {
      console.error(`  ✗ Error:`, error);
    }
  }
}

testAudio();