import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, X, Send } from 'lucide-react';

const MAX_DURATION_S = 120; // 2 minutos máximo

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/** Elige el MIME type soportado por el navegador para grabación de audio. */
function elegirMimeType() {
  const candidatos = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];
  return candidatos.find(t => MediaRecorder.isTypeSupported(t)) || '';
}

/**
 * Botón de grabar nota de voz con cronómetro.
 * Props:
 *   onSend(blob)  — callback para enviar el audio.
 *   disabled      — desactiva mientras se envía otro mensaje.
 */
const VoiceRecorder = ({ onSend, disabled }) => {
  const [estado,    setEstado]    = useState('idle');   // idle | recording | preview
  const [segundos,  setSegundos]  = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl,  setAudioUrl]  = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const timerRef         = useRef(null);
  const streamRef        = useRef(null);

  const detenerTodosLosTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => {
        try {
          t.enabled = false;
          t.stop();
        } catch (e) {}
      });
      streamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(t => {
        try {
          t.enabled = false;
          t.stop();
        } catch (e) {}
      });
    }
  }, []);

  // Limpiar al desmontar
  useEffect(() => () => {
    clearInterval(timerRef.current);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    detenerTodosLosTracks();
  }, [audioUrl, detenerTodosLosTracks]);

  const detenerGrabacion = useCallback(() => {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
    detenerTodosLosTracks();
  }, [detenerTodosLosTracks]);

  const iniciarGrabacion = useCallback(async () => {
    setError('');
    try {
      if (!navigator.mediaDevices && !navigator.getUserMedia && !navigator.webkitGetUserMedia && !navigator.mozGetUserMedia) {
        if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          setError('El navegador bloquea el micrófono por HTTP IP. Usa localhost o habilita la bandera en chrome://flags.');
          return;
        }
        setError('Navegador sin soporte para captura de audio.');
        return;
      }

      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      let stream = null;
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      } else {
        const legacy = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        stream = await new Promise((resolve, reject) => {
          legacy.call(navigator, { audio: audioConstraints }, resolve, reject);
        });
      }

      streamRef.current = stream;
      const mimeType = elegirMimeType();
      const mrOptions = {};
      if (mimeType) mrOptions.mimeType = mimeType;
      mrOptions.audioBitsPerSecond = 128000; // 128 kbps calidad HD de voz

      const mr = new MediaRecorder(stream, mrOptions);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        const url  = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        setEstado('preview');
        detenerTodosLosTracks();
      };

      mr.start(1000); // 1000ms evita micro-cortes y artefactos de audio WebM
      setEstado('recording');
      setSegundos(0);

      timerRef.current = setInterval(() => {
        setSegundos(prev => {
          if (prev + 1 >= MAX_DURATION_S) { detenerGrabacion(); return prev + 1; }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Permiso de micrófono denegado en el navegador.');
      } else if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setError('El navegador bloquea el micrófono por HTTP IP. Usa localhost o chrome://flags.');
      } else {
        setError('No se pudo acceder al micrófono (' + (err.message || err.name || 'Error') + ').');
      }
    }
  }, [detenerGrabacion, detenerTodosLosTracks]);

  const cancelar = useCallback(() => {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
    detenerTodosLosTracks();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setEstado('idle');
    setSegundos(0);
    setAudioBlob(null);
    setAudioUrl(null);
    setError('');
  }, [audioUrl, detenerTodosLosTracks]);

  const enviar = useCallback(async () => {
    if (!audioBlob || loading) return;
    setLoading(true);
    detenerTodosLosTracks();
    try {
      await onSend(audioBlob, formatTime(segundos));
      cancelar();
    } catch { setError('Error al enviar la nota de voz.'); }
    finally  { setLoading(false); }
  }, [audioBlob, loading, onSend, cancelar, detenerTodosLosTracks, segundos]);

  if (estado === 'idle') {
    return (
      <>
        <button
          className="icon-btn-gray"
          title="Grabar nota de voz"
          disabled={disabled}
          onClick={iniciarGrabacion}
        >
          <Mic size={20} />
        </button>
        {error && <span className="voice-error-inline">{error}</span>}
      </>
    );
  }

  return (
    <div className="voice-recorder-bar">
      <button className="voice-cancel-btn" onClick={cancelar} title="Cancelar">
        <X size={16} />
      </button>

      {estado === 'recording' && (
        <>
          <span className="voice-dot" />
          <span className="voice-timer">{formatTime(segundos)}</span>
          <span className="voice-hint">Grabando...</span>
          <button className="voice-stop-btn" onClick={detenerGrabacion} title="Detener">
            <Square size={16} />
          </button>
        </>
      )}

      {estado === 'preview' && (
        <>
          <audio src={audioUrl} controls className="voice-preview-audio" />
          <button className="voice-send-btn" onClick={enviar} disabled={loading} title="Enviar">
            {loading ? <span className="media-spinner" /> : <Send size={16} />}
          </button>
        </>
      )}

      {error && <span className="voice-error-inline">{error}</span>}
    </div>
  );
};

export default VoiceRecorder;
