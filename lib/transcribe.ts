import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-flash-latest";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

/**
 * Transcribes a recorded voice answer to text via Gemini's native audio
 * understanding - no separate speech-to-text service needed.
 */
export async function transcribeAudio(audioFile: File): Promise<string> {
  const client = getClient();
  const bytes = Buffer.from(await audioFile.arrayBuffer());

  const response = await client.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: "Transcribe this audio verbatim. Return only the transcript, no commentary." },
          { inlineData: { data: bytes.toString("base64"), mimeType: audioFile.type || "audio/webm" } },
        ],
      },
    ],
  });

  return response.text?.trim() ?? "";
}
