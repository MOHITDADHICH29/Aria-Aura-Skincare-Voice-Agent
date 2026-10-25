import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { sanitizeForSpeech } from "@/lib/tts";
import { DEFAULT_GEMINI_TTS_VOICE, AUDIO_CACHE_VERSION } from "@/lib/config";

function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1): Buffer {
  const wavHeader = Buffer.alloc(44);
  wavHeader.write("RIFF", 0);
  wavHeader.writeUInt32LE(36 + pcmBuffer.length, 4);
  wavHeader.write("WAVE", 8);
  wavHeader.write("fmt ", 12);
  wavHeader.writeUInt32LE(16, 16); // subchunk1size (16 for PCM)
  wavHeader.writeUInt16LE(1, 20); // audioFormat (1 for PCM)
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(sampleRate * numChannels * 2, 28); // byteRate
  wavHeader.writeUInt16LE(numChannels * 2, 32); // blockAlign
  wavHeader.writeUInt16LE(16, 34); // bitsPerSample
  wavHeader.write("data", 36);
  wavHeader.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([wavHeader, pcmBuffer]);
}

const TTS_MODELS = [
  "gemini-3.8-flash-tts",
  "gemini-3.8-flash-lite-tts",
  "gemini-2.5-flash-preview-tts",
  "gemini-3.1-flash-tts-preview",
];

const serverAudioCache = new Map<string, Buffer>();

// Global cached client instance for Vercel warm starts
let globalAiClient: GoogleGenAI | null = null;
function getAiClient(apiKey: string): GoogleGenAI {
  if (!globalAiClient) {
    globalAiClient = new GoogleGenAI({ apiKey });
  }
  return globalAiClient;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const rawText = String(body.text || "").trim();

    // Pure speakable text sanitizer: strictly clean reply only, no style instructions
    const cleanText = sanitizeForSpeech(rawText);

    if (!cleanText) {
      return NextResponse.json({ error: "Valid speakable text is required" }, { status: 400 });
    }

    // Explicit voice name: body.voiceName allows dev /voice-test page to test voices
    const voiceName = body.voiceName || process.env.GEMINI_TTS_VOICE || DEFAULT_GEMINI_TTS_VOICE;

    // Cache key incorporates voiceName and cache version to prevent stale/incorrect voice playback
    const cacheKey = `${AUDIO_CACHE_VERSION}:${voiceName}:${cleanText.toLowerCase().trim()}`;
    if (serverAudioCache.has(cacheKey)) {
      const cachedBuf = serverAudioCache.get(cacheKey)!;
      const durationSec = ((cachedBuf.length - 44) / 48000).toFixed(2);
      return new Response(new Uint8Array(cachedBuf), {
        status: 200,
        headers: {
          "Content-Type": "audio/wav",
          "Content-Length": String(cachedBuf.length),
          "X-Voice-Name": voiceName,
          "X-Sample-Rate": "24000",
          "X-Engine": "gemini",
          "X-Duration-Seconds": durationSec,
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      });
    }

    const ai = getAiClient(apiKey);
    let lastError: any = null;

    for (const model of TTS_MODELS) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: cleanText }] }],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName,
                },
              },
            },
          },
        });

        const part = res.candidates?.[0]?.content?.parts?.[0];
        if (part?.inlineData?.data) {
          const mime = (part.inlineData.mimeType || "").toLowerCase();
          const rawBuf = Buffer.from(part.inlineData.data, "base64");

          let wavBuf: Buffer;
          let pcmLen: number;
          if (mime.includes("wav")) {
            wavBuf = rawBuf;
            pcmLen = rawBuf.length - 44;
          } else {
            pcmLen = rawBuf.length;
            wavBuf = pcmToWav(rawBuf, 24000, 1);
          }

          serverAudioCache.set(cacheKey, wavBuf);
          const durationSec = (pcmLen / 48000).toFixed(2);

          return new Response(new Uint8Array(wavBuf), {
            status: 200,
            headers: {
              "Content-Type": "audio/wav",
              "Content-Length": String(wavBuf.length),
              "X-Voice-Name": voiceName,
              "X-Sample-Rate": "24000",
              "X-Engine": "gemini",
              "X-Duration-Seconds": durationSec,
              "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
              "Pragma": "no-cache",
              "Expires": "0",
            },
          });
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[TTS Route] Model '${model}' failed:`, err?.message || err);
      }
    }

    throw lastError || new Error("All Gemini TTS models failed");
  } catch (err: any) {
    console.error("[TTS Route Error]", err);
    const errMsg = err?.message || "TTS synthesis failed";
    const isQuota =
      err?.status === 429 ||
      errMsg.includes("429") ||
      errMsg.includes("RESOURCE_EXHAUSTED") ||
      errMsg.includes("quota");
    const status = isQuota ? 429 : (err?.status && typeof err.status === "number" ? err.status : 500);

    return NextResponse.json(
      { error: errMsg, isQuota, status },
      { status }
    );
  }
}
