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

/**
 * Reproductor de nota de voz estilo WhatsApp.
 * Props: src, msgId, fecha, estado, remitente, formatMsgTime, MessageTick
 */
const VoicePlayer = ({ src, msgId, fecha, estado, remitente, formatMsgTime, MessageTick }) => {
  const [playing,  setPlaying]  = useState(false);
  const [current,  setCurrent]  = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  const bars    = useMemo(() => generateBars(msgId), [msgId]);
  const total   = duration || 1;
  const progress = current / total;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime  = () => setCurrent(audio.currentTime);
    const onMeta  = () => setDuration(audio.duration);
    const onEnded = () => { setPlaying(false); setCurrent(0); };
    audio.addEventListener('timeupdate',    onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended',         onEnded);
    return () => {
      audio.removeEventListener('timeupdate',    onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended',         onEnded);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else         { audio.play().catch(() => {}); setPlaying(true); }
  };

  const seek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * duration;
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
          <span className="voice-dur">{formatDur(playing ? current : duration)}</span>
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
