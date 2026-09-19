/**
 * @file audioNotificationPlayer.js
 * @description Síntesis de tonos de notificación mediante Web Audio API nativo.
 * Incorpora compresión dinámica para maximizar volumen y presencia sin distorsión,
 * nuevos tonos melódicos extendidos de hasta 2.0 segundos, y soporte nativo para
 * que el usuario suba su propio archivo de audio personalizado guardado en IndexedDB.
 */

export const TONOS_DISPONIBLES = [
  // ── Tonos Melódicos y Extendidos (hasta 2.0 segundos) ──
  {
    id: 'marimba',
    nombre: 'Marimba Tropical',
    desc: 'Arpegio cálido de 5 notas con caída orgánica',
    duracion: '1.8s',
    categoria: 'largo',
    icono: '🌴',
  },
  {
    id: 'cyber',
    nombre: 'Cyber Synth Chime',
    desc: 'Acorde futurista exuberante con estela estéreo',
    duracion: '2.0s',
    categoria: 'largo',
    icono: '🚀',
  },
  {
    id: 'triunfo',
    nombre: 'Fanfarria de Éxito',
    desc: 'Secuencia triunfal de notas brillantes y claras',
    duracion: '1.7s',
    categoria: 'largo',
    icono: '🎺',
  },
  {
    id: 'zen_bell',
    nombre: 'Campana Zen Armónica',
    desc: 'Resonancia profunda y armónicos sostenidos',
    duracion: '2.0s',
    categoria: 'largo',
    icono: '🔔',
  },
  {
    id: 'ejecutivo',
    nombre: 'Doble Timbre Ejecutivo',
    desc: 'Dos toques elegantes con alta presencia acústica',
    duracion: '1.5s',
    categoria: 'largo',
    icono: '💼',
  },
  {
    id: 'radar',
    nombre: 'Pulso Neón Dinámico',
    desc: 'Alerta rítmica moderna de 3 pulsos ascendentes',
    duracion: '1.5s',
    categoria: 'largo',
    icono: '⚡',
  },

  // ── Tonos Clásicos y Directos (0.2s a 0.5s) ──
  {
    id: 'default',
    nombre: 'Predeterminado Potente',
    desc: 'Tono estándar con presencia acústica reforzada',
    duracion: '0.4s',
    categoria: 'clasico',
    icono: '📢',
  },
  {
    id: 'pop',
    nombre: 'WhatsApp Pop',
    desc: 'Burbuja clásica, rápida y cristalina',
    duracion: '0.2s',
    categoria: 'clasico',
    icono: '🫧',
  },
  {
    id: 'crystal',
    nombre: 'Campana Cristal',
    desc: 'Timbre cristalino resonante de triple armónico',
    duracion: '0.6s',
    categoria: 'clasico',
    icono: '🎐',
  },
  {
    id: 'chime',
    nombre: 'Acorde Chime',
    desc: 'Doble nota armónica moderna y balanceada',
    duracion: '0.5s',
    categoria: 'clasico',
    icono: '🎵',
  },
  {
    id: 'soft_bubble',
    nombre: 'Burbujas Suaves',
    desc: 'Toque amortiguado y discreto para alta actividad',
    duracion: '0.3s',
    categoria: 'clasico',
    icono: '💧',
  },
  {
    id: 'ios_note',
    nombre: 'Nota de iOS (iPhone)',
    desc: 'Timbre cristalino original de Apple Messages',
    duracion: '0.4s',
    categoria: 'clasico',
    icono: '🍎',
  },
  {
    id: 'ios_tritone',
    nombre: 'Tri-tono de Apple iOS',
    desc: 'El legendario tono de 3 notas de iPhone (Do-Fa-La)',
    duracion: '0.6s',
    categoria: 'clasico',
    icono: '📱',
  },

  // ── Silencioso ──
  {
    id: 'silent',
    nombre: 'Silencioso',
    desc: 'Sin reproducción de sonido de alerta',
    duracion: '0s',
    categoria: 'silencio',
    icono: '🔕',
  },
];

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Crea una cadena de audio con compresor dinámico para lograr el máximo volumen
 * sin distorsión ni clipeo digital.
 */
function getAudioPipeline(volumenFactor = 1.0) {
  const ctx = getAudioContext();
  if (!ctx) return null;

  try {
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-14, ctx.currentTime);
    compressor.knee.setValueAtTime(6, ctx.currentTime);
    compressor.ratio.setValueAtTime(5, ctx.currentTime);
    compressor.attack.setValueAtTime(0.002, ctx.currentTime);
    compressor.release.setValueAtTime(0.12, ctx.currentTime);

    const masterGain = ctx.createGain();
    const clampedVol = Math.min(Math.max(volumenFactor, 0.3), 1.5);
    // Volumen maestro elevado: 0.92 * factor
    masterGain.gain.setValueAtTime(clampedVol * 0.92, ctx.currentTime);

    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);

    return { ctx, input: compressor, now: ctx.currentTime };
  } catch (err) {
    console.warn('[AUDIO PIPELINE] Error inicializando pipeline:', err);
    return null;
  }
}

/**
 * Reproduce un tono sintetizado con volumen optimizado y compresión dinámica.
 * @param {string} tonoId
 * @param {number} volumenFactor Multiplicador de volumen (0.5 = suave, 1.0 = normal fuerte, 1.3 = muy fuerte)
 */
export function reproducirTono(tonoId = 'default', volumenFactor = 1.0) {
  if (tonoId === 'silent') return;

  const pipeline = getAudioPipeline(volumenFactor);
  if (!pipeline) return;

  const { ctx, input, now } = pipeline;

  try {
    switch (tonoId) {
      // ══════════════════════════════════════════════════════════
      // TONOS MELÓDICOS EXTENDIDOS (HASTA 2.0 SEGUNDOS)
      // ══════════════════════════════════════════════════════════

      case 'marimba': {
        // Arpegio de 5 notas: Do5, Mi5, Sol5, La5, Do6
        const notas = [
          { f: 523.25, t: 0.00, dur: 0.40, g: 0.70 },
          { f: 659.25, t: 0.12, dur: 0.40, g: 0.72 },
          { f: 783.99, t: 0.24, dur: 0.45, g: 0.75 },
          { f: 880.00, t: 0.36, dur: 0.50, g: 0.78 },
          { f: 1046.50, t: 0.50, dur: 1.25, g: 0.85 },
        ];

        notas.forEach(({ f, t, dur, g }) => {
          const osc = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'triangle';
          osc2.type = 'sine';

          osc.frequency.setValueAtTime(f, now + t);
          osc2.frequency.setValueAtTime(f * 2, now + t);

          gain.gain.setValueAtTime(0.001, now + t);
          gain.gain.linearRampToValueAtTime(g, now + t + 0.008);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + t + dur);

          osc.connect(gain);
          osc2.connect(gain);
          gain.connect(input);

          osc.start(now + t);
          osc.stop(now + t + dur + 0.01);
          osc2.start(now + t);
          osc2.stop(now + t + dur + 0.01);
        });
        break;
      }

      case 'cyber': {
        // Acorde futurista Re mayor 9 (Re5, Fa#5, La5, Mi6) con filtro en barrido (1.9s)
        const chord = [587.33, 739.99, 880.00, 1318.51];
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3200, now);
        filter.frequency.exponentialRampToValueAtTime(700, now + 1.85);

        const chordGain = ctx.createGain();
        chordGain.gain.setValueAtTime(0.001, now);
        chordGain.gain.linearRampToValueAtTime(0.75, now + 0.04);
        chordGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.95);

        filter.connect(chordGain);
        chordGain.connect(input);

        chord.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          osc.type = idx % 2 === 0 ? 'sawtooth' : 'sine';
          osc.frequency.setValueAtTime(f, now);
          osc.connect(filter);
          osc.start(now);
          osc.stop(now + 1.98);
        });
        break;
      }

      case 'triunfo': {
        // Fanfarria optimista: Sol4, Do5, Mi5, Sol5 (1.7s)
        const fanfarria = [
          { f: 392.00, t: 0.00, dur: 0.22, g: 0.65 },
          { f: 523.25, t: 0.14, dur: 0.22, g: 0.70 },
          { f: 659.25, t: 0.28, dur: 0.24, g: 0.75 },
          { f: 783.99, t: 0.44, dur: 1.22, g: 0.82 },
        ];

        fanfarria.forEach(({ f, t, dur, g }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, now + t);

          gain.gain.setValueAtTime(0.001, now + t);
          gain.gain.linearRampToValueAtTime(g, now + t + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + t + dur);

          osc.connect(gain);
          gain.connect(input);

          osc.start(now + t);
          osc.stop(now + t + dur + 0.01);
        });
        break;
      }

      case 'zen_bell': {
        // Campana profunda con armónicos enriquecidos de 2.0s
        const armónicos = [
          { f: 432.0, g: 0.55 },
          { f: 864.0, g: 0.35 },
          { f: 1296.0, g: 0.22 },
          { f: 1728.0, g: 0.12 },
        ];

        armónicos.forEach(({ f, g }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now);

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(g * 0.9, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

          osc.connect(gain);
          gain.connect(input);

          osc.start(now);
          osc.stop(now + 2.02);
        });
        break;
      }

      case 'ejecutivo': {
        // Doble timbre ejecutivo (1.5s): dos toques espaciados
        const toques = [
          { f1: 740, f2: 1110, t: 0.00, dur: 0.42, g: 0.70 },
          { f1: 880, f2: 1320, t: 0.36, dur: 1.10, g: 0.80 },
        ];

        toques.forEach(({ f1, f2, t, dur, g }) => {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = 'sine';
          osc2.type = 'triangle';

          osc1.frequency.setValueAtTime(f1, now + t);
          osc2.frequency.setValueAtTime(f2, now + t);

          gain.gain.setValueAtTime(0.001, now + t);
          gain.gain.linearRampToValueAtTime(g, now + t + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + t + dur);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(input);

          osc1.start(now + t);
          osc1.stop(now + t + dur + 0.01);
          osc2.start(now + t);
          osc2.stop(now + t + dur + 0.01);
        });
        break;
      }

      case 'radar': {
        // Pulso neón dinámico ascendente de 3 pasos (1.5s)
        const pulsos = [
          { fStart: 440, fEnd: 660, t: 0.00, dur: 0.18, g: 0.65 },
          { fStart: 550, fEnd: 880, t: 0.20, dur: 0.18, g: 0.72 },
          { fStart: 700, fEnd: 1180, t: 0.40, dur: 1.05, g: 0.82 },
        ];

        pulsos.forEach(({ fStart, fEnd, t, dur, g }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(fStart, now + t);
          osc.frequency.exponentialRampToValueAtTime(fEnd, now + t + 0.08);

          gain.gain.setValueAtTime(0.001, now + t);
          gain.gain.linearRampToValueAtTime(g, now + t + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + t + dur);

          osc.connect(gain);
          gain.connect(input);

          osc.start(now + t);
          osc.stop(now + t + dur + 0.01);
        });
        break;
      }

      // ══════════════════════════════════════════════════════════
      // TONOS CLÁSICOS Y DIRECTOS (VOLUMEN REFORZADO)
      // ══════════════════════════════════════════════════════════

      case 'pop': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';

        osc.frequency.setValueAtTime(360, now);
        osc.frequency.exponentialRampToValueAtTime(1100, now + 0.04);
        osc.frequency.exponentialRampToValueAtTime(540, now + 0.12);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.85, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(input);

        osc.start(now);
        osc.stop(now + 0.19);
        break;
      }

      case 'crystal': {
        const freqs = [1046.5, 1318.5, 2093.0];
        freqs.forEach((freq, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + (index * 0.02));

          const baseGain = 0.55 / (index + 0.8);
          gain.gain.setValueAtTime(0.001, now + (index * 0.02));
          gain.gain.linearRampToValueAtTime(baseGain, now + (index * 0.02) + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);

          osc.connect(gain);
          gain.connect(input);

          osc.start(now + (index * 0.02));
          osc.stop(now + 0.59);
        });
        break;
      }

      case 'chime': {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';

        osc1.frequency.setValueAtTime(587.33, now);
        osc2.frequency.setValueAtTime(880.00, now + 0.08);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.70, now + 0.02);
        gain.gain.linearRampToValueAtTime(0.80, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(input);

        osc1.start(now);
        osc1.stop(now + 0.32);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.49);
        break;
      }

      case 'soft_bubble': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';

        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(680, now + 0.06);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.72, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.connect(gain);
        gain.connect(input);

        osc.start(now);
        osc.stop(now + 0.29);
        break;
      }

      case 'ios_note': {
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc2.type = 'triangle';

        osc.frequency.setValueAtTime(1318.5, now);
        osc2.frequency.setValueAtTime(2637.0, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.85, now + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(input);

        osc.start(now);
        osc.stop(now + 0.44);
        osc2.start(now);
        osc2.stop(now + 0.12);
        break;
      }

      case 'ios_tritone': {
        // Tri-tono oficial de Apple iOS (Sol#5 -> Si5 -> Mi6)
        const tritone = [
          { f: 830.60, t: 0.00, dur: 0.15, g: 0.72 },
          { f: 987.77, t: 0.10, dur: 0.15, g: 0.78 },
          { f: 1318.5, t: 0.20, dur: 0.46, g: 0.88 },
        ];

        tritone.forEach(({ f, t, dur, g }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + t);

          gain.gain.setValueAtTime(0.001, now + t);
          gain.gain.linearRampToValueAtTime(g, now + t + 0.005);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + t + dur);

          osc.connect(gain);
          gain.connect(input);

          osc.start(now + t);
          osc.stop(now + t + dur + 0.01);
        });
        break;
      }

      case 'default':
      default: {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';

        osc.frequency.setValueAtTime(784, now);
        osc.frequency.setValueAtTime(1046.5, now + 0.08);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.82, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        osc.connect(gain);
        gain.connect(input);

        osc.start(now);
        osc.stop(now + 0.39);
        break;
      }
    }
  } catch (err) {
    console.warn('[AUDIO NOTIF] Error al sintetizar tono:', err);
  }
}

/**
 * Reproduce un audio Blob personalizado (subido por el usuario)
 * @param {Blob} blob
 * @param {number} volumenFactor
 */
export function reproducirAudioBlob(blob, volumenFactor = 1.0) {
  if (!blob) return;
  try {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const clampedVol = Math.min(Math.max(volumenFactor, 0.2), 1.0);
    audio.volume = clampedVol;

    audio.play().then(() => {
      audio.onended = () => {
        URL.revokeObjectURL(url);
      };
    }).catch(err => {
      console.warn('[AUDIO BLOB] Error reproduciendo blob:', err);
      URL.revokeObjectURL(url);
    });
  } catch (err) {
    console.warn('[AUDIO BLOB] Fallback error:', err);
  }
}

// ══════════════════════════════════════════════════════════
// ALMACENAMIENTO DE TONOS PERSONALIZADOS EN INDEXEDDB
// ══════════════════════════════════════════════════════════

const DB_NAME = 'isp_chatbot_audio_db';
const DB_VERSION = 1;
const STORE_NAME = 'custom_tones';

function openAudioDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB no soportado'));
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function getCustomAudioKey(userId, canalId) {
  return `ci_custom_sound_${userId}_${canalId}`;
}

export async function saveCustomAudio(userId, canalId, fileBlob, fileName) {
  if (!userId || !canalId || !fileBlob) return null;
  const id = getCustomAudioKey(userId, canalId);
  try {
    const db = await openAudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record = {
        id,
        userId,
        canalId,
        blob: fileBlob,
        name: fileName || fileBlob.name || 'Sonido_Personalizado.mp3',
        size: fileBlob.size,
        type: fileBlob.type,
        updatedAt: Date.now(),
      };
      const req = store.put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[AUDIO DB] Error guardando archivo de audio:', err);
    return null;
  }
}

export async function getCustomAudio(userId, canalId) {
  if (!userId || !canalId) return null;
  const id = getCustomAudioKey(userId, canalId);
  try {
    const db = await openAudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteCustomAudio(userId, canalId) {
  if (!userId || !canalId) return false;
  const id = getCustomAudioKey(userId, canalId);
  try {
    const db = await openAudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return false;
  }
}

// ══════════════════════════════════════════════════════════
// CONFIGURACIÓN POR CANAL Y USUARIO (LOCALSTORAGE)
// ══════════════════════════════════════════════════════════

export function getStorageKey(userId, canalId) {
  return `ci_notif_config_${userId}_${canalId}`;
}

export function getChatNotificationConfig(userId, canalId) {
  if (!userId || !canalId) {
    return { tono: 'default', volumen: 1.0, customName: null, silenciadoHasta: null };
  }
  try {
    const raw = localStorage.getItem(getStorageKey(userId, canalId));
    if (!raw) {
      return { tono: 'default', volumen: 1.0, customName: null, silenciadoHasta: null };
    }
    const parsed = JSON.parse(raw);
    return {
      tono: parsed.tono || 'default',
      volumen: typeof parsed.volumen === 'number' ? parsed.volumen : 1.0,
      customName: parsed.customName || null,
      silenciadoHasta: parsed.silenciadoHasta || null,
    };
  } catch {
    return { tono: 'default', volumen: 1.0, customName: null, silenciadoHasta: null };
  }
}

export function saveChatNotificationConfig(userId, canalId, config) {
  if (!userId || !canalId) return;
  try {
    const actual = getChatNotificationConfig(userId, canalId);
    const nuevo = { ...actual, ...config };
    localStorage.setItem(getStorageKey(userId, canalId), JSON.stringify(nuevo));
  } catch (err) {
    console.warn('[AUDIO NOTIF] Error guardando config:', err);
  }
}

export function isChatMuted(userId, canalId) {
  const config = getChatNotificationConfig(userId, canalId);
  if (!config.silenciadoHasta) return false;
  if (config.silenciadoHasta === 'siempre') return true;

  const expiration = new Date(config.silenciadoHasta).getTime();
  if (isNaN(expiration)) return false;
  return expiration > Date.now();
}

/**
 * Función principal llamada al recibir un mensaje para emitir la notificación sonora personalizada.
 */
export function notificarMensajeCanal(userId, canalId) {
  if (isChatMuted(userId, canalId)) return;
  const config = getChatNotificationConfig(userId, canalId);
  const vol = config.volumen || 1.0;

  if (config.tono === 'custom') {
    getCustomAudio(userId, canalId).then(item => {
      if (item && item.blob) {
        reproducirAudioBlob(item.blob, vol);
      } else {
        reproducirTono('default', vol);
      }
    }).catch(() => {
      reproducirTono('default', vol);
    });
  } else {
    reproducirTono(config.tono || 'default', vol);
  }
}

/**
 * Tono de conversación oficial de WhatsApp (Mensaje recibido en chat abierto)
 * El icónico sonido de burbuja / gota de agua "plop" característico de WhatsApp.
 */
export function reproducirTonoConversacionWhatsApp(volumen = 1.0) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const play = () => {
    try {
      const now = ctx.currentTime;
      const gainNode = ctx.createGain();
      const finalVol = Math.min(Math.max(volumen, 0.3), 2.0) * 1.0;
      gainNode.gain.setValueAtTime(finalVol, now);
      gainNode.connect(ctx.destination);

      // Oscilador 1: Burbuja de agua (curva de frecuencia ascendente rápida característica)
      const osc1 = ctx.createOscillator();
      const oscGain1 = ctx.createGain();
      osc1.type = 'sine';

      // Frecuencia: empieza en 430 Hz, sube rápidamente a 1020 Hz y amortigua en 740 Hz
      osc1.frequency.setValueAtTime(430, now);
      osc1.frequency.exponentialRampToValueAtTime(1020, now + 0.035);
      osc1.frequency.exponentialRampToValueAtTime(740, now + 0.10);

      // Envolvente de volumen (ataque instantáneo y caída de burbuja líquida)
      oscGain1.gain.setValueAtTime(0.001, now);
      oscGain1.gain.linearRampToValueAtTime(0.95, now + 0.004);
      oscGain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      osc1.connect(oscGain1);
      oscGain1.connect(gainNode);

      // Oscilador 2: Armónico sutil para resonancia de cristal / agua
      const osc2 = ctx.createOscillator();
      const oscGain2 = ctx.createGain();
      osc2.type = 'triangle';

      osc2.frequency.setValueAtTime(860, now);
      osc2.frequency.exponentialRampToValueAtTime(1720, now + 0.035);

      oscGain2.gain.setValueAtTime(0.001, now);
      oscGain2.gain.linearRampToValueAtTime(0.32, now + 0.005);
      oscGain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

      osc2.connect(oscGain2);
      oscGain2.connect(gainNode);

      osc1.start(now);
      osc1.stop(now + 0.15);
      osc2.start(now);
      osc2.stop(now + 0.10);
    } catch (err) {
      console.warn('[AUDIO WA CONV] Error:', err);
    }
  };

  if (ctx.state === 'suspended') {
    ctx.resume().then(play).catch(() => {});
  } else {
    play();
  }
}

/**
 * Tono de conversación oficial de iOS (Apple Messages / iPhone)
 * El toque cristalino "plink" de alta definición de Apple al recibir mensaje dentro del chat.
 */
export function reproducirTonoConversacionIOS(volumen = 1.0) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const play = () => {
    try {
      const now = ctx.currentTime;
      const gainNode = ctx.createGain();
      const finalVol = Math.min(Math.max(volumen, 0.3), 2.0) * 0.95;
      gainNode.gain.setValueAtTime(finalVol, now);
      gainNode.connect(ctx.destination);

      // Tono cristalino de Apple (Mi6 ~1318.5 Hz + resonancia pura de xilófono de vidrio)
      const osc1 = ctx.createOscillator();
      const oscGain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1318.5, now);

      oscGain1.gain.setValueAtTime(0.001, now);
      oscGain1.gain.linearRampToValueAtTime(0.92, now + 0.002);
      oscGain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

      osc1.connect(oscGain1);
      oscGain1.connect(gainNode);

      // Armónico superior de campana Apple
      const osc2 = ctx.createOscillator();
      const oscGain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(2637.0, now);

      oscGain2.gain.setValueAtTime(0.001, now);
      oscGain2.gain.linearRampToValueAtTime(0.28, now + 0.003);
      oscGain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

      osc2.connect(oscGain2);
      oscGain2.connect(gainNode);

      osc1.start(now);
      osc1.stop(now + 0.25);
      osc2.start(now);
      osc2.stop(now + 0.09);
    } catch (err) {
      console.warn('[AUDIO IOS CONV] Error:', err);
    }
  };

  if (ctx.state === 'suspended') {
    ctx.resume().then(play).catch(() => {});
  } else {
    play();
  }
}

/**
 * Sonido especial in-chat al recibir mensaje en la conversación activa.
 * Ejecuta el tono preferido por el usuario ('whatsapp' por defecto o 'ios').
 */
export function reproducirSonidoWhatsAppInChat(volumen = 1.0) {
  const savedVol = typeof window !== 'undefined' ? parseFloat(localStorage.getItem('ci_notif_volumen') || '1.0') : 1.0;
  const estilo = (typeof window !== 'undefined' && localStorage.getItem('ci_inchat_sound_style')) || 'whatsapp';
  const effectiveVol = volumen * (isNaN(savedVol) ? 1.0 : savedVol);
  if (estilo === 'ios') {
    reproducirTonoConversacionIOS(effectiveVol);
  } else {
    reproducirTonoConversacionWhatsApp(effectiveVol);
  }
}


