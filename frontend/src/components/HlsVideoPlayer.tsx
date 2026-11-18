import Hls from 'hls.js';
import { useEffect, useRef } from 'react';

interface HlsVideoPlayerProps {
  hlsStreamingUrl: string;
  initialPositionInSeconds: number;
  onWatchPositionChange: (currentPositionInSeconds: number) => void;
  onPlaybackEnded: () => void;
}

const WATCH_POSITION_SAVE_INTERVAL_IN_MILLISECONDS = 15000;

/** Adaptive streaming (HLS). Safari plays HLS natively; other browsers use hls.js. */
export function HlsVideoPlayer({ hlsStreamingUrl, initialPositionInSeconds, onWatchPositionChange, onPlaybackEnded }: HlsVideoPlayerProps) {
  const videoElementReference = useRef<HTMLVideoElement>(null);
  const timestampOfLastSavedPositionReference = useRef<number>(0);

  useEffect(() => {
    const videoElement = videoElementReference.current;
    if (!videoElement) return;

    let hlsPlayerInstance: Hls | null = null;

    const resumeFromPreviousPosition = () => {
      if (initialPositionInSeconds > 0) videoElement.currentTime = initialPositionInSeconds;
    };

    if (Hls.isSupported()) {
      hlsPlayerInstance = new Hls();
      hlsPlayerInstance.loadSource(hlsStreamingUrl);
      hlsPlayerInstance.attachMedia(videoElement);
      hlsPlayerInstance.on(Hls.Events.MANIFEST_PARSED, resumeFromPreviousPosition);
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      videoElement.src = hlsStreamingUrl;
      videoElement.addEventListener('loadedmetadata', resumeFromPreviousPosition, { once: true });
    }

    return () => hlsPlayerInstance?.destroy();
  }, [hlsStreamingUrl, initialPositionInSeconds]);

  const handleTimeUpdate = () => {
    const videoElement = videoElementReference.current;
    if (!videoElement) return;

    const currentTimestamp = Date.now();
    if (currentTimestamp - timestampOfLastSavedPositionReference.current >= WATCH_POSITION_SAVE_INTERVAL_IN_MILLISECONDS) {
      timestampOfLastSavedPositionReference.current = currentTimestamp;
      onWatchPositionChange(Math.floor(videoElement.currentTime));
    }
  };

  return (
    <video
      ref={videoElementReference}
      className="video-player"
      controls
      controlsList="nodownload"
      onContextMenu={(contextMenuEvent) => contextMenuEvent.preventDefault()}
      onTimeUpdate={handleTimeUpdate}
      onPause={() => videoElementReference.current && onWatchPositionChange(Math.floor(videoElementReference.current.currentTime))}
      onEnded={onPlaybackEnded}
    />
  );
}
