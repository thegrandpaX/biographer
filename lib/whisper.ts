import OpenAI from "openai";

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey });
}

/** Transcribes a recorded voice answer to text via Whisper. */
export async function transcribeAudio(audioFile: File): Promise<string> {
  const client = getClient();
  const result = await client.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
  });
  return result.text;
}
