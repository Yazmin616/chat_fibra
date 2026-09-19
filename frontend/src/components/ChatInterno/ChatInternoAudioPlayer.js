import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, Mic } from 'lucide-react';

export function formatDur(sec) {
  if (!sec || !isFinite(sec) || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function generateBars(seed, count = 30) {
  const bars = [];
  let s = Number(seed) || 1;
  for (let i = 0; i < count; i++) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const h = 20 + (Math.abs(s) % 65);
    bars.push(h);
  }
  return bars;
}

const SPEEDS = [1, 1.5, 2];
export const durationCache = new Map();

const ChatInternoAudioPlayer = ({
  src,
  msgId,
  isOwn = false,
  formatTime,
  ticks,
  senderFoto,
  senderNombre,
  senderColor,
}) => {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(() => durationCache.get(src) || 0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const audioRef = useRef(null);

  const bars = useMemo(() => generateBars(msgId), [msgId]);
  const total = isFinite(duration) && duration > 0 ? duration : 0;
  const progress = total > 0 ? Math.min(1, Math.max(0, current / total)) : 0;

  // Resolver duración finita para WebM en Chromium (que inicialmente reporta Infinity)
  useEffect(() => {
    if (!src) return;

    if (durationCache.has(src)) {
      setDuration(durationCache.get(src));
      return;
    }

    let cancel = false;

    // Método 1: Decodificación exacta con AudioContext nativo
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        fetch(src)
          .then(r => r.arrayBuffer())
          .then(ab => ctx.decodeAudioData(ab))
          .then(buf => {
            if (!cancel && buf && isFinite(buf.duration) && buf.duration > 0) {
              setDuration(buf.duration);
              durationCache.set(src, buf.duration);
            }
            ctx.close().catch(() => {});
          })
          .catch(() => {});
      }
    } catch (e) {}

    return () => {
      cancel = true;
    };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      const c = audio.currentTime;
      setCurrent(c);
      if (!isFinite(duration) || duration <= 0) {
        if (isFinite(audio.duration) && audio.duration > 0) {
          setDuration(audio.duration);
          durationCache.set(src, audio.duration);
        } else if (audio.seekable && audio.seekable.length > 0) {
          const end = audio.seekable.end(audio.seekable.length - 1);
          if (isFinite(end) && end > 0 && end !== Infinity) {
            setDuration(end);
            durationCache.set(src, end);
          }
        }
      }
    };

    const onMeta = () => {
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        durationCache.set(src, audio.duration);
      } else if (audio.duration === Infinity) {
        // En Chromium, seek al final fuerza a calcular la duración real del archivo WebM
        const handleSeeked = () => {
          audio.removeEventListener('seeked', handleSeeked);
          if (isFinite(audio.duration) && audio.duration > 0) {
            setDuration(audio.duration);
            durationCache.set(src, audio.duration);
          } else if (isFinite(audio.currentTime) && audio.currentTime > 0) {
            setDuration(audio.currentTime);
            durationCache.set(src, audio.currentTime);
          }
          audio.currentTime = 0;
        };
        audio.addEventListener('seeked', handleSeeked);
        audio.currentTime = 1e101;
      }
    };

    const onDurationChange = () => {
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        durationCache.set(src, audio.duration);
      }
    };

    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
      const finalDur = isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : (isFinite(audio.currentTime) && audio.currentTime > 0 ? audio.currentTime : duration);
      if (finalDur && isFinite(finalDur) && finalDur > 0) {
        setDuration(finalDur);
        durationCache.set(src, finalDur);
      }
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src, duration]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(() => {});
      setPlaying(true);
    }
  };

  const seek = (e) => {
    const audio = audioRef.current;
    if (!audio || !total) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * total;
    setCurrent(audio.currentTime);
  };

  const cycleSpeed = (e) => {
    e.stopPropagation();
    const nextIdx = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(nextIdx);
    if (audioRef.current) {
      audioRef.current.playbackRate = SPEEDS[nextIdx];
    }
  };

  return (
    <div className={`wa-voice-player ${isOwn ? 'own' : 'incoming'}`}>
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Botón Play / Pause estilo WhatsApp Desktop */}
      <button
        type="button"
        className="wa-voice-play-btn"
        onClick={toggle}
        aria-label={playing ? 'Pausar nota de voz' : 'Reproducir nota de voz'}
      >
        {playing ? (
          <Pause size={22} fill="currentColor" />
        ) : (
          <Play size={22} fill="currentColor" style={{ marginLeft: 3 }} />
        )}
      </button>

      {/* Cuerpo de la nota de voz: Onda interactiva y Metadatos */}
      <div className="wa-voice-body">
        <div
          className="wa-voice-waveform"
          onClick={seek}
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          title="Haz clic para avanzar o retroceder"
        >
          {bars.map((h, i) => {
            const active = (i / bars.length) <= progress;
            return (
              <span
                key={i}
                className={`wa-wbar ${active ? 'active' : ''}`}
                style={{ height: `${h}%` }}
              />
            );
          })}
          {/* Cabeza deslizante verde de progreso (scrubber dot) */}
          <span
            className="wa-voice-scrubber-dot"
            style={{ left: `calc(${progress * 100}% - 5px)` }}
          />
        </div>

        <div className="wa-voice-meta">
          <span className="wa-voice-duration">
            {formatDur(playing || current > 0 ? current : total)}
          </span>

          {playing && (
            <button
              type="button"
              className="wa-voice-speed-pill"
              onClick={cycleSpeed}
              title="Cambiar velocidad de reproducción"
            >
              {SPEEDS[speedIdx]}x
            </button>
          )}

          <div className="wa-voice-footer-right">
            {formatTime && <span className="wa-msg-time">{formatTime}</span>}
            {ticks && <span className="wa-msg-status-ticks">{ticks}</span>}
          </div>
        </div>
      </div>

      {/* Avatar del remitente a la derecha con badge de micrófono */}
      {(senderFoto || senderNombre) && (
        <div className="wa-voice-avatar-col">
          <div className="wa-voice-avatar-wrap" title={senderNombre}>
            {senderFoto ? (
              <img src={senderFoto} alt={senderNombre} className="wa-voice-avatar-img" />
            ) : (
              <div
                className="wa-voice-avatar-placeholder"
                style={{ background: senderColor || '#00a884' }}
              >
                {senderNombre ? senderNombre.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <span className="wa-voice-mic-badge">
              <Mic size={10} color="#ffffff" />
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInternoAudioPlayer;
