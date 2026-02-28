import 'dotenv/config';
import { ElevenLabsClient, play } from '@elevenlabs/elevenlabs-js';
import fs from 'fs';

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || apiKey === "your_elevenlabs_api_key_here") {
    console.error("Please set a valid ELEVENLABS_API_KEY in your .env file.");
    process.exit(1);
  }

  const elevenlabs = new ElevenLabsClient({
    apiKey: apiKey,
  });

  console.log("Synthesizing audio...");
  try {
    const audioStream = await elevenlabs.textToSpeech.convert(
      'JBFqnCBsd6RMkjVDRZzb', // voice_id (George)
      {
        text: 'The first move is what sets everything in motion.',
        model_id: 'eleven_multilingual_v2',
        output_format: 'mp3_44100_128',
      }
    );

    // Convert the stream to a buffer and play it/save it it
    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);
    fs.writeFileSync('elevenlabs_test.mp3', audioBuffer);
    console.log("Audio written to elevenlabs_test.mp3");


  } catch (error) {
    console.error("Error synthesizing speech:", error);
  }
}

main();
