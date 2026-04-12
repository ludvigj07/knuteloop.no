import { useEffect, useRef } from 'react';

export function MobileVideo({
  src,
  className,
  controls = true,
  autoPlay = true,
  loop = true,
  muted = true,
  playsInline = true,
  preload = 'auto',
  poster,
  onError,
  onLoadedData,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement) {
      return undefined;
    }

    videoElement.muted = muted;
    videoElement.playsInline = playsInline;
    videoElement.autoplay = autoPlay;
    videoElement.loop = loop;
    videoElement.preload = preload;
    videoElement.setAttribute('playsinline', '');
    videoElement.setAttribute('webkit-playsinline', 'true');
    videoElement.setAttribute('muted', '');

    if (!autoPlay) {
      return undefined;
    }

    const tryPlay = () => {
      videoElement.play().catch(() => {});
    };

    if (videoElement.readyState >= 2) {
      tryPlay();
      return undefined;
    }

    videoElement.addEventListener('loadeddata', tryPlay, { once: true });

    return () => {
      videoElement.removeEventListener('loadeddata', tryPlay);
    };
  }, [autoPlay, loop, muted, playsInline, preload, src]);

  return (
    <video
      key={src}
      ref={videoRef}
      className={className}
      controls={controls}
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      playsInline={playsInline}
      preload={preload}
      poster={poster}
      src={src}
      onError={onError}
      onLoadedData={onLoadedData}
    />
  );
}
