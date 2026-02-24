import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authServer";

export const runtime = "nodejs";

const HF_ENDPOINT = "https://api-inference.huggingface.co/models";
const ALLOWED_MODELS = new Set([
  "facebook/mms-tts-hin",
  "facebook/mms-tts-eng",
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { text, model } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    if (!model || !ALLOWED_MODELS.has(model)) {
      return NextResponse.json(
        { error: "Invalid model. Use facebook/mms-tts-eng or facebook/mms-tts-hin" },
        { status: 400 },
      );
    }

    const hfApiKey = process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY;

    if (!hfApiKey) {
      return NextResponse.json(
        { error: "Missing HUGGINGFACE_API_KEY or HF_API_KEY" },
        { status: 500 },
      );
    }

    const trimmedText = text.trim().slice(0, 400);
    let response = null;
    let responseBodyText = "";

    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch(`${HF_ENDPOINT}/${model}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfApiKey}`,
          "Content-Type": "text/plain",
          Accept: "audio/wav",
        },
        body: trimmedText,
      });

      if (response.ok) {
        break;
      }

      responseBodyText = await response.text();

      if (response.status !== 503) {
        break;
      }

      let waitMs = 2500;
      try {
        const parsed = JSON.parse(responseBodyText);
        const estimatedTime = Number(parsed?.estimated_time);
        if (!Number.isNaN(estimatedTime) && estimatedTime > 0) {
          waitMs = Math.min(Math.ceil(estimatedTime * 1000), 8000);
        }
      } catch {}

      await sleep(waitMs);
    }

    if (!response || !response.ok) {
      return NextResponse.json(
        {
          error: `TTS generation failed: ${response?.status || 500} ${responseBodyText}`,
        },
        { status: 502 },
      );
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: `TTS returned non-audio response: ${errorBody}` },
        { status: 502 },
      );
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to generate TTS audio" },
      { status: 500 },
    );
  }
}
