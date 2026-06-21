// Raooza OS - YouTube Transcript API Route
// Fetches transcript for a YouTube video using youtube-transcript package

import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const videoId = req.nextUrl.searchParams.get("videoId");
    if (!videoId) {
      return NextResponse.json({ error: "videoId parameter required" }, { status: 400 });
    }

    // Validate videoId format (11 chars typically)
    if (!/^[a-zA-Z0-9_-]{6,}$/.test(videoId)) {
      return NextResponse.json({ error: "Invalid videoId" }, { status: 400 });
    }

    const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: "pt",
    });

    if (!transcript || transcript.length === 0) {
      // Try without lang spec
      const fallback = await YoutubeTranscript.fetchTranscript(videoId);
      if (!fallback || fallback.length === 0) {
        return NextResponse.json(
          { error: "Transcrição não disponível para este vídeo" },
          { status: 404 },
        );
      }
      return NextResponse.json({
        transcript: fallback.map((t) => ({
          text: t.text,
          start: t.offset,
          duration: t.duration,
        })),
      });
    }

    return NextResponse.json({
      transcript: transcript.map((t) => ({
        text: t.text,
        start: t.offset,
        duration: t.duration,
      })),
    });
  } catch (e: any) {
    console.error("[/api/youtube-transcript]", e);
    return NextResponse.json(
      { error: e?.message ?? "Erro ao buscar transcrição" },
      { status: 500 },
    );
  }
}
