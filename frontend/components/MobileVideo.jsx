import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

export const MobileVideo = forwardRef(function MobileVideo(
  {
    src,
    className,
    controls = true,
    autoPlay = true,
    loop = true,
    muted = true,
    playsInline = true,
    preload = 'auto',
    poster,
    isActive = true,
    playMode = 'auto',
    onAutoplayBlocked,
    onError,
    onLoadedData,
  },
  ref,
) {
  const videoRef = useRef(null);
  const [lastAutoplayBlocked, setLastAutoplayBlocked] = useState(false);

  const attemptPlay = useCallback(
    async ({ withSound = false, triggeredByUser = false } = {}) => {
      const videoElement = videoRef.current;

      if (!videoElement) {
        return false;
      }

      videoElement.muted = withSound ? false : muted;

      if (withSound) {
        videoElement.removeAttribute('muted');
      } else if (muted) {
        videoElement.setAttribute('muted', '');
      } else {
        videoElement.removeAttribute('muted');
      }

      try {
        await videoElement.play();
        setLastAutoplayBlocked(false);
        onAutoplayBlocked?.(false);
        return true;
      } catch {
        if (!triggeredByUser) {
          setLastAutoplayBlocked(true);
          onAutoplayBlocked?.(true);
        }

        return false;
      }
    },
    [muted, onAutoplayBlocked],
  );

  const pauseVideo = useCallback(() => {
    const videoElement = videoRef.current;

    if (!videoElement) {
      return;
    }

    videoElement.pause();
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      element: videoRef.current,
      pause: pauseVideo,
      async playMuted() {
        return attemptPlay({ withSound: false, triggeredByUser: true });
      },
      async playWithAudio() {
        return attemptPlay({ withSound: true, triggeredByUser: true });
      },
    }),
    [attemptPlay, pauseVideo],
  );

  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement) {
      return undefined;
    }

    videoElement.playsInline = playsInline;
    videoElement.autoplay = autoPlay;
    videoElement.loop = loop;
    videoElement.preload = preload;
    videoElement.controls = controls;
    videoElement.setAttribute('playsinline', '');
    videoElement.setAttribute('webkit-playsinline', 'true');

    if (muted) {
      videoElement.muted = true;
      videoElement.setAttribute('muted', '');
    } else {
      videoElement.muted = false;
      videoElement.removeAttribute('muted');
    }

    return undefined;
  }, [autoPlay, controls, loop, muted, playsInline, preload, src]);

  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement || !autoPlay) {
      return undefined;
    }

    if (!isActive) {
      pauseVideo();
      if (playMode === 'sound-preferred') {
        videoElement.currentTime = 0;
      }
      return undefined;
    }

    const playWithSound = playMode === 'sound-preferred' && !muted;
    const runPlaybackAttempt = () => {
      attemptPlay({
        withSound: playWithSound,
        triggeredByUser: false,
      });
    };

    if (videoElement.readyState >= 2) {
      runPlaybackAttempt();
      return undefined;
    }

    videoElement.addEventListener('loadeddata', runPlaybackAttempt, { once: true });

    return () => {
      videoElement.removeEventListener('loadeddata', runPlaybackAttempt);
    };
  }, [attemptPlay, autoPlay, isActive, muted, playMode, src, pauseVideo]);

  // Sikkerhetsnett: pause videoen når selve elementet ikke lenger er synlig,
  // uavhengig av om foreldrens isActive-prop har rukket å oppdateres. Dette
  // unngår at lyd fortsetter når kortet scrolles ut av synsfelt i feed-reel.
  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting && !videoElement.paused) {
            videoElement.pause();
          }
        }
      },
      { threshold: 0.25 },
    );

    observer.observe(videoElement);
    return () => observer.disconnect();
  }, [src]);

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
      data-autoplay-blocked={lastAutoplayBlocked ? 'true' : 'false'}
      onError={onError}
      onLoadedData={onLoadedData}
    />
  );
});
