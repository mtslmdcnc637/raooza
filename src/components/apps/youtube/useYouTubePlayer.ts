"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// YouTube IFrame API loader singleton
let apiLoaded: Promise<any> | null = null;
function loadYouTubeAPI(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject();
  if ((window as any).YT && (window as any).YT.Player) {
    return Promise.resolve((window as any).YT);
  }
  if (apiLoaded) return apiLoaded;
  apiLoaded = new Promise((resolve) => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    (window as any).onYouTubeIframeAPIReady = () => resolve((window as any).YT);
  });
  return apiLoaded;
}

export function useYouTubePlayer(
  containerId: string,
  videoId: string | null,
  onReady?: () => void,
  onProgress?: (sec: number) => void,
  onEnd?: () => void,
) {
  const playerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const progressIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;

    loadYouTubeAPI().then((YT) => {
      if (cancelled) return;
      // Destroy previous player
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
      setIsReady(false);

      playerRef.current = new YT.Player(containerId, {
        videoId,
        playerVars: {
          autoplay: 0,
          modestbranding: 1,
          rel: 0,
          fs: 1,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            if (cancelled) return;
            setIsReady(true);
            setDuration(playerRef.current?.getDuration?.() ?? 0);
            onReady?.();
          },
          onStateChange: (e: any) => {
            setIsPlaying(e.data === 1); // YT.PlayerState.PLAYING
            if (e.data === 0) onEnd?.(); // ended
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, containerId]);

  // Poll progress while playing
  useEffect(() => {
    if (!isReady) return;
    progressIntervalRef.current = setInterval(() => {
      if (!playerRef.current) return;
      try {
        const t = playerRef.current.getCurrentTime?.() ?? 0;
        setCurrentTime(t);
        onProgress?.(t);
        const d = playerRef.current.getDuration?.() ?? 0;
        if (d && d !== duration) setDuration(d);
      } catch {}
    }, 1000);
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, isPlaying]);

  const play = useCallback(() => playerRef.current?.playVideo?.(), []);
  const pause = useCallback(() => playerRef.current?.pauseVideo?.(), []);
  const seekTo = useCallback((sec: number) => {
    playerRef.current?.seekTo?.(sec, true);
    setCurrentTime(sec);
  }, []);
  const setRate = useCallback((rate: number) => {
    playerRef.current?.setPlaybackRate?.(rate);
    setPlaybackRate(rate);
  }, []);
  const skip = useCallback((deltaSec: number) => {
    if (!playerRef.current) return;
    const t = (playerRef.current.getCurrentTime?.() ?? 0) + deltaSec;
    seekTo(Math.max(0, t));
  }, [seekTo]);

  return {
    isReady,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    play,
    pause,
    seekTo,
    setRate,
    skip,
  };
}
