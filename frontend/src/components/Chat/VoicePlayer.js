import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause } from 'lucide-react';

function formatDur(sec) {
  if (!sec || !isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Genera barras de amplitud pseudo-aleatorias pero deterministas (seeded por msgId). */
function generateBars(seed, count = 30) {
  const bars = [];
  let s = seed || 1;
  for (let i = 0; i < count; i++) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const h = 20 + (Math.abs(s) % 60); // 20–80 %
    bars.push(h);
  }
  return bars;
}

const durationCache = new Map();

/**
 * Reproductor de nota de voz estilo WhatsApp.
 * Props: src, msgId, fecha, estado, remitente, formatMsgTime, MessageTick
 */
const VoicePlayer = ({ src, msgId, fecha, estado, remitente, formatMsgTime, MessageTick }) => {
  const [playing,  setPlaying]  = useState(false);
  const [current,  setCurrent]  = useState(0);
  const [duration, setDuration] = useState(() => durationCache.get(src) || 0);
  const audioRef = useRef(null);

  const bars    = useMemo(() => generateBars(msgId), [msgId]);
  const total   = isFinite(duration) && duration > 0 ? duration : 0;
  const progress = total > 0 ? Math.min(1, Math.max(0, current / total)) : 0;

  // Resolver duración finita para WebM en Chromium (que inicialmente reporta Infinity)
  useEffect(() => {
    if (!src) return;
    if (durationCache.has(src)) {
      setDuration(durationCache.get(src));
      return;
    }

    let cancel = false;
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

    return () => { cancel = true; };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime  = () => {
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
    const onMeta  = () => {
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        durationCache.set(src, audio.duration);
      } else if (audio.duration === Infinity) {
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
    audio.addEventListener('timeupdate',    onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended',         onEnded);
    return () => {
      audio.removeEventListener('timeupdate',    onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended',         onEnded);
    };
  }, [src, duration]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else         { audio.play().catch(() => {}); setPlaying(true); }
  };

  const seek = (e) => {
    const audio = audioRef.current;
    if (!audio || !total) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * total;
    setCurrent(audio.currentTime);
  };

  const isSent = remitente !== 'user';

  return (
    <div className={`voice-player ${isSent ? 'voice-sent' : 'voice-received'}`}>
      <audio ref={audioRef} src={src} preload="metadata" />

      <button className="voice-play-circle" onClick={toggle} aria-label={playing ? 'Pausar' : 'Reproducir'}>
        {playing
          ? <Pause  size={16} fill="currentColor" />
          : <Play   size={16} fill="currentColor" style={{ marginLeft: 2 }} />}
      </button>

      <div className="voice-body">
        <div className="voice-waveform" onClick={seek} role="progressbar" aria-valuenow={Math.round(progress * 100)}>
          {bars.map((h, i) => {
            const active = i / bars.length < progress;
            return (
              <span
                key={i}
                className={`wbar ${active ? 'wbar-active' : ''}`}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>
        <div className="voice-meta">
          <span className="voice-dur">{formatDur(playing || current > 0 ? current : total)}</span>
          <span className="voice-time-tick">
            {formatMsgTime(fecha)}
            {isSent && <MessageTick estado={estado} />}
          </span>
        </div>
      </div>
    </div>
  );
};

export default VoicePlayer;
