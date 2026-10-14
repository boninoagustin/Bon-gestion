import React, { useEffect, useState, useRef } from 'react';

const STORAGE_KEY = 'bon_intro_seen';
const FADE_OUT_DURATION = 1500; // 1.5s de transición suave al panel de control
const SKIP_FADE_DURATION = 600; // 600ms si el usuario decide omitir

export const IntroAnimation: React.FC = () => {
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const forceIntro = params.get('intro') === 'true' || params.get('intro') === '1';
      if (forceIntro) return true;
      return !sessionStorage.getItem(STORAGE_KEY);
    }
    return true;
  });

  const [isEnding, setIsEnding] = useState(false); // Activa el fade out y difuminado
  const [hasStarted, setHasStarted] = useState(false); // Detecta cuando el video realmente arrancó
  const [fadeDurationMs, setFadeDurationMs] = useState(FADE_OUT_DURATION);
  const videoRef = useRef<HTMLVideoElement>(null);
  const endingRef = useRef(false);
  const fadeOutTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const markAsSeen = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Ignorar restricciones de almacenamiento
    }
  };

  // Inicia la transición suave (fade out) y programa la eliminación del DOM
  const startFadeOut = (duration = FADE_OUT_DURATION) => {
    if (endingRef.current) return;
    endingRef.current = true;
    setIsEnding(true);
    setFadeDurationMs(duration);
    markAsSeen();

    if (fadeOutTimeoutRef.current) {
      clearTimeout(fadeOutTimeoutRef.current);
    }

    fadeOutTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, duration);
  };

  // Omitir manualmente (clic, botón o tecla Escape)
  const handleSkip = () => {
    startFadeOut(SKIP_FADE_DURATION);
  };

  // El avance del fade depende del reloj del video, no del reloj de pared.
  // Un stall conserva el último fotograma visible; sólo ended/omitir/error desmonta.
  const [playbackOpacity, setPlaybackOpacity] = useState(1);
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video && !endingRef.current && Number.isFinite(video.duration) && video.duration > 0) {
      setPlaybackOpacity(Math.max(0.05, Math.min(1, (video.duration - video.currentTime) / 1.5)));
    }
  };

  const handlePlaying = () => {
    setHasStarted(true);
  };

  const handleEnded = () => {
    // Si el video termina y por alguna razón aún no se inició el fade out, completarlo
    startFadeOut(400);
  };

  useEffect(() => {
    if (!isVisible) return;

    // Reproducción automática asegurando muted para evitar bloqueos
    const playVideo = async () => {
      if (videoRef.current) {
        try {
          videoRef.current.muted = true;
          videoRef.current.currentTime = 0;
          await videoRef.current.play();
        } catch (err) {
          console.warn("[IntroAnimation] Autoplay bloqueado o no permitido:", err);
          // Si el navegador bloquea autoplay, desvanecer inmediatamente al panel
          startFadeOut(300);
        }
      }
    };

    playVideo();

    // Atajo de teclado: Escape para saltar
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Timeout de seguridad generoso (20s) únicamente como resguardo por si el archivo no carga
    const safetyTimer = setTimeout(() => {
      startFadeOut(500);
    }, 20000);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(safetyTimer);
      if (fadeOutTimeoutRef.current) {
        clearTimeout(fadeOutTimeoutRef.current);
      }
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div 
      onClick={handleSkip}
      style={{
        opacity: isEnding ? 0 : playbackOpacity,
        transitionDuration: isEnding ? `${fadeDurationMs}ms` : '0ms'
      }}
      className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-all ease-out cursor-pointer select-none ${
        isEnding 
          ? 'opacity-0 blur-sm scale-[1.01] pointer-events-none' 
          : 'opacity-100 blur-0 scale-100 pointer-events-auto'
      }`}
      title="Clic o presiona Esc para omitir"
    >
      {/* Botón sutil de Omitir */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleSkip();
        }}
        className={`absolute top-6 right-6 z-20 px-3.5 py-1.5 rounded-full bg-zinc-950/70 hover:bg-zinc-900/90 text-amber-200/80 hover:text-amber-100 border border-amber-500/20 text-xs font-medium tracking-wide uppercase backdrop-blur-md shadow-xl transition-all duration-300 flex items-center gap-2 group cursor-pointer ${
          isEnding ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <span>Omitir</span>
        <span className="text-amber-400/60 group-hover:text-amber-300 transition-colors">✕</span>
      </button>

      {/* Video intro en resolución completa */}
      <video
        ref={videoRef}
        src="intro.mp4" 
        muted
        autoPlay
        playsInline
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onPlaying={handlePlaying}
        onEnded={handleEnded}
        onError={(e) => {
          console.error("[IntroAnimation] Error cargando video intro.mp4", e);
          startFadeOut(200);
        }}
        className={`w-full h-full object-contain md:object-cover transition-opacity duration-700 ease-out ${
          hasStarted ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};