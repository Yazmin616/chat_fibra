import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Bell,
  BellOff,
  Volume2,
  Play,
  Check,
  Upload,
  Trash2,
  Music,
  Sparkles,
  Volume1,
  MessageSquare
} from 'lucide-react';
import {
  TONOS_DISPONIBLES,
  reproducirTono,
  reproducirAudioBlob,
  reproducirTonoConversacionWhatsApp,
  reproducirTonoConversacionIOS,
  getChatNotificationConfig,
  saveChatNotificationConfig,
  saveCustomAudio,
  getCustomAudio,
  deleteCustomAudio
} from '../../utils/audioNotificationPlayer';

const MUTE_OPTIONS = [
  { id: 'none',   label: 'Con sonido (Notificaciones activadas)' },
  { id: '8h',     label: 'Silenciar por 8 horas' },
  { id: '1w',     label: 'Silenciar por 1 semana' },
  { id: 'always', label: 'Silenciar siempre' },
];

const VOLUME_LEVELS = [
  { val: 0.8, label: 'Normal (80%)', desc: 'Moderado' },
  { val: 1.0, label: 'Fuerte (100%)', desc: 'Recomendado' },
  { val: 1.35, label: 'Muy Fuerte (135%)', desc: 'Máxima potencia' },
];

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ChatInternoNotificationSettingsModal = ({
  userId,
  canal,
  onClose
}) => {
  const [selectedTone, setSelectedTone] = useState('default');
  const [volumeLevel, setVolumeLevel] = useState(1.0);
  const [inChatSoundStyle, setInChatSoundStyle] = useState(() => (typeof window !== 'undefined' && localStorage.getItem('ci_inchat_sound_style')) || 'whatsapp');
  const [muteOption, setMuteOption] = useState('none');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Estado del permiso de notificaciones del navegador
  const [notifPermission, setNotifPermission] = useState(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );

  const handleRequestPermission = async () => {
    if (!('Notification' in window)) return;
    try {
      const result = await Notification.requestPermission();
      setNotifPermission(result);
      if (result === 'granted') {
        // Disparar una notificación de prueba inmediatamente
        new Notification('✅ Notificaciones activadas', {
          body: 'Las notificaciones de escritorio están funcionando correctamente.',
          icon: window.location.origin + '/logo192.png',
          silent: false,
        });
      }
    } catch (err) {
      console.warn('No se pudo solicitar permiso:', err);
    }
  };

  // Audio personalizado (IndexedDB)
  const [customAudio, setCustomAudio] = useState(null);
  const [cargandoAudio, setCargandoAudio] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!userId || !canal?.id) return;
    const config = getChatNotificationConfig(userId, canal.id);
    setSelectedTone(config.tono || 'default');
    setVolumeLevel(typeof config.volumen === 'number' ? config.volumen : 1.0);

    if (!config.silenciadoHasta) {
      setMuteOption('none');
    } else if (config.silenciadoHasta === 'siempre') {
      setMuteOption('always');
    } else {
      const exp = new Date(config.silenciadoHasta).getTime();
      if (exp > Date.now()) {
        const diffHours = (exp - Date.now()) / (1000 * 60 * 60);
        if (diffHours <= 9) {
          setMuteOption('8h');
        } else {
          setMuteOption('1w');
        }
      } else {
        setMuteOption('none');
      }
    }

    // Cargar si existe audio personalizado en IndexedDB
    getCustomAudio(userId, canal.id).then(rec => {
      if (rec) setCustomAudio(rec);
    }).catch(() => {});
  }, [userId, canal?.id]);

  const handleTestTone = (e, toneId) => {
    e.stopPropagation();
    reproducirTono(toneId, volumeLevel);
  };

  const handleTestCustomAudio = (e) => {
    e.stopPropagation();
    if (customAudio?.blob) {
      reproducirAudioBlob(customAudio.blob, volumeLevel);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i)) {
      alert('Por favor selecciona un archivo de audio válido (MP3, WAV, OGG, M4A).');
      return;
    }

    // Límite de seguridad: máximo 8 MB
    if (file.size > 8 * 1024 * 1024) {
      alert('El archivo es muy pesado. Te sugerimos un archivo de audio menor a 8 MB.');
      return;
    }

    setCargandoAudio(true);
    try {
      const record = await saveCustomAudio(userId, canal.id, file, file.name);
      if (record) {
        setCustomAudio(record);
        setSelectedTone('custom');
        // Probar audio inmediatamente
        reproducirAudioBlob(file, volumeLevel);
      }
    } catch (err) {
      console.error('Error guardando audio:', err);
      alert('No se pudo guardar el archivo de audio.');
    } finally {
      setCargandoAudio(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteCustomAudio = async (e) => {
    e.stopPropagation();
    await deleteCustomAudio(userId, canal.id);
    setCustomAudio(null);
    if (selectedTone === 'custom') {
      setSelectedTone('default');
    }
  };

  const handleSave = () => {
    let silenciadoHasta = null;
    const now = Date.now();

    if (muteOption === '8h') {
      silenciadoHasta = new Date(now + 8 * 60 * 60 * 1000).toISOString();
    } else if (muteOption === '1w') {
      silenciadoHasta = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (muteOption === 'always') {
      silenciadoHasta = 'siempre';
    }

    // Guardar estilo in-chat (WhatsApp o iOS)
    if (typeof window !== 'undefined') {
      localStorage.setItem('ci_inchat_sound_style', inChatSoundStyle);
    }

    saveChatNotificationConfig(userId, canal.id, {
      tono: selectedTone,
      volumen: volumeLevel,
      customName: customAudio?.name || null,
      silenciadoHasta
    });

    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const chatName = canal?.tipo === 'directo'
    ? (canal.otro_participante?.nombre || 'Chat Directo')
    : (canal?.nombre || 'Grupo');

  const tonosLargos = TONOS_DISPONIBLES.filter(t => t.categoria === 'largo');
  const tonosClasicos = TONOS_DISPONIBLES.filter(t => t.categoria === 'clasico');
  const tonoSilencioso = TONOS_DISPONIBLES.find(t => t.categoria === 'silencio');

  return (
    <div className="wa-notif-modal-overlay" onClick={onClose}>
      <div className="wa-notif-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Cabecera */}
        <div className="wa-notif-modal-header">
          <div className="wa-notif-modal-title-wrap">
            <Bell size={20} color="#00a884" />
            <div>
              <h3 className="wa-notif-modal-title">Ajustes de notificaciones</h3>
              <div className="wa-notif-modal-subtitle">{chatName}</div>
            </div>
          </div>
          <button type="button" className="wa-notif-modal-close-btn" onClick={onClose} title="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className="wa-notif-modal-content">
          {/* BANNER: Estado del permiso de notificaciones del navegador */}
          {notifPermission !== 'unsupported' && (
            <div className={`wa-notif-perm-banner ${notifPermission}`}>
              {notifPermission === 'granted' && (
                <>
                  <span className="wa-notif-perm-icon">✅</span>
                  <span className="wa-notif-perm-text">Notificaciones de escritorio <strong>activadas</strong></span>
                </>
              )}
              {notifPermission === 'denied' && (
                <>
                  <span className="wa-notif-perm-icon">🚫</span>
                  <span className="wa-notif-perm-text">
                    Notificaciones <strong>bloqueadas</strong> por el navegador.
                    Ve a <strong>Configuración del sitio</strong> y permite las notificaciones manualmente.
                  </span>
                </>
              )}
              {notifPermission === 'default' && (
                <>
                  <span className="wa-notif-perm-icon">🔔</span>
                  <span className="wa-notif-perm-text">Las notificaciones de escritorio no están habilitadas.</span>
                  <button
                    type="button"
                    className="wa-notif-perm-btn"
                    onClick={handleRequestPermission}
                  >
                    Habilitar notificaciones
                  </button>
                </>
              )}
            </div>
          )}

          {/* SECCIÓN 0: TONO AL ESTAR DENTRO DE LA CONVERSACIÓN (IN-CHAT) */}
          <div className="wa-notif-section">
            <div className="wa-notif-section-title">
              <MessageSquare size={16} color="#00a884" />
              <span>Tono de conversación activa (In-Chat WhatsApp / iOS)</span>
            </div>
            <div className="wa-notif-inchat-options">
              <div
                className={`wa-notif-inchat-card ${inChatSoundStyle === 'whatsapp' ? 'selected' : ''}`}
                onClick={() => {
                  setInChatSoundStyle('whatsapp');
                  reproducirTonoConversacionWhatsApp(volumeLevel);
                }}
              >
                <div className="wa-notif-radio-outer">
                  {inChatSoundStyle === 'whatsapp' && <div className="wa-notif-radio-inner" />}
                </div>
                <div className="wa-notif-inchat-info">
                  <div className="wa-notif-inchat-title">
                    <span>🟢 WhatsApp Oficial</span>
                    <span className="wa-notif-duration-badge">Pop de agua</span>
                  </div>
                  <div className="wa-notif-tone-desc">El clásico tono de conversación de burbuja al chatear</div>
                </div>
                <button
                  type="button"
                  className="wa-notif-tone-test-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    reproducirTonoConversacionWhatsApp(volumeLevel);
                  }}
                  title="Probar tono WhatsApp"
                >
                  <Play size={14} fill="currentColor" />
                </button>
              </div>

              <div
                className={`wa-notif-inchat-card ${inChatSoundStyle === 'ios' ? 'selected' : ''}`}
                onClick={() => {
                  setInChatSoundStyle('ios');
                  reproducirTonoConversacionIOS(volumeLevel);
                }}
              >
                <div className="wa-notif-radio-outer">
                  {inChatSoundStyle === 'ios' && <div className="wa-notif-radio-inner" />}
                </div>
                <div className="wa-notif-inchat-info">
                  <div className="wa-notif-inchat-title">
                    <span>🍎 Apple iOS (iPhone)</span>
                    <span className="wa-notif-duration-badge">Plink cristalino</span>
                  </div>
                  <div className="wa-notif-tone-desc">El tono de mensaje cristalino in-chat de Apple / iMessage</div>
                </div>
                <button
                  type="button"
                  className="wa-notif-tone-test-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    reproducirTonoConversacionIOS(volumeLevel);
                  }}
                  title="Probar tono iOS"
                >
                  <Play size={14} fill="currentColor" />
                </button>
              </div>
            </div>
          </div>

          {/* SECCIÓN 1: POTENCIA Y VOLUMEN */}
          <div className="wa-notif-section">
            <div className="wa-notif-section-title">
              <Volume2 size={16} color="#00a884" />
              <span>Volumen y Potencia de Notificación</span>
            </div>
            <div className="wa-notif-vol-selector">
              {VOLUME_LEVELS.map(lvl => {
                const isSelected = Math.abs(volumeLevel - lvl.val) < 0.05;
                return (
                  <button
                    key={lvl.val}
                    type="button"
                    className={`wa-notif-vol-pill ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      setVolumeLevel(lvl.val);
                      if (selectedTone === 'custom' && customAudio?.blob) {
                        reproducirAudioBlob(customAudio.blob, lvl.val);
                      } else if (selectedTone !== 'silent') {
                        reproducirTono(selectedTone, lvl.val);
                      }
                    }}
                  >
                    {lvl.val >= 1.2 ? <Volume2 size={14} /> : <Volume1 size={14} />}
                    <span className="wa-notif-vol-text">{lvl.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECCIÓN 2: AUDIO PERSONALIZADO SUBIDO POR EL USUARIO */}
          <div className="wa-notif-section">
            <div className="wa-notif-section-title">
              <Music size={16} color="#00a884" />
              <span>Mi sonido personalizado (Subir archivo)</span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {customAudio ? (
              <div
                className={`wa-notif-custom-card ${selectedTone === 'custom' ? 'selected' : ''}`}
                onClick={() => setSelectedTone('custom')}
              >
                <div className="wa-notif-radio-outer">
                  {selectedTone === 'custom' && <div className="wa-notif-radio-inner" />}
                </div>

                <div className="wa-notif-custom-icon-wrap">
                  <Music size={18} color="#00a884" />
                </div>

                <div className="wa-notif-custom-details">
                  <div className="wa-notif-custom-name" title={customAudio.name}>
                    {customAudio.name}
                  </div>
                  <div className="wa-notif-custom-meta">
                    Archivo propio • {formatBytes(customAudio.size)}
                  </div>
                </div>

                <div className="wa-notif-custom-actions">
                  <button
                    type="button"
                    className="wa-notif-tone-test-btn"
                    onClick={handleTestCustomAudio}
                    title="Escuchar mi sonido"
                  >
                    <Play size={14} fill="currentColor" />
                  </button>
                  <button
                    type="button"
                    className="wa-notif-custom-icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    title="Reemplazar por otro archivo"
                  >
                    <Upload size={14} />
                  </button>
                  <button
                    type="button"
                    className="wa-notif-custom-icon-btn danger"
                    onClick={handleDeleteCustomAudio}
                    title="Eliminar sonido personalizado"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="wa-notif-upload-trigger"
                onClick={() => fileInputRef.current?.click()}
                disabled={cargandoAudio}
              >
                <Upload size={16} color="#00a884" />
                <span>
                  {cargandoAudio ? 'Cargando archivo...' : 'Subir sonido propio (MP3, WAV, OGG, M4A)'}
                </span>
              </button>
            )}
          </div>

          {/* SECCIÓN 3: TONOS DE HASTA 2 SEGUNDOS (MELÓDICOS Y EXTENDIDOS) */}
          <div className="wa-notif-section">
            <div className="wa-notif-section-title">
              <Sparkles size={16} color="#00a884" />
              <span>Tonos melódicos y extendidos (hasta 2.0s)</span>
            </div>

            <div className="wa-notif-tone-list">
              {tonosLargos.map(tone => {
                const isSelected = selectedTone === tone.id;
                return (
                  <div
                    key={tone.id}
                    className={`wa-notif-tone-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedTone(tone.id)}
                  >
                    <div className="wa-notif-radio-outer">
                      {isSelected && <div className="wa-notif-radio-inner" />}
                    </div>

                    <div className="wa-notif-tone-emoji">{tone.icono}</div>

                    <div className="wa-notif-tone-info">
                      <div className="wa-notif-tone-header-line">
                        <span className="wa-notif-tone-name">{tone.nombre}</span>
                        <span className="wa-notif-duration-badge">{tone.duracion}</span>
                      </div>
                      <div className="wa-notif-tone-desc">{tone.desc}</div>
                    </div>

                    <button
                      type="button"
                      className="wa-notif-tone-test-btn"
                      onClick={(e) => handleTestTone(e, tone.id)}
                      title={`Escuchar muestra (${tone.duracion})`}
                    >
                      <Play size={14} fill="currentColor" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECCIÓN 4: TONOS CLÁSICOS Y DIRECTOS */}
          <div className="wa-notif-section">
            <div className="wa-notif-section-title">
              <Volume2 size={16} color="#54656f" />
              <span>Tonos clásicos y directos (WhatsApp e iOS)</span>
            </div>

            <div className="wa-notif-tone-list">
              {tonosClasicos.map(tone => {
                const isSelected = selectedTone === tone.id;
                return (
                  <div
                    key={tone.id}
                    className={`wa-notif-tone-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedTone(tone.id)}
                  >
                    <div className="wa-notif-radio-outer">
                      {isSelected && <div className="wa-notif-radio-inner" />}
                    </div>

                    <div className="wa-notif-tone-emoji">{tone.icono}</div>

                    <div className="wa-notif-tone-info">
                      <div className="wa-notif-tone-header-line">
                        <span className="wa-notif-tone-name">{tone.nombre}</span>
                        <span className="wa-notif-duration-badge minor">{tone.duracion}</span>
                      </div>
                      <div className="wa-notif-tone-desc">{tone.desc}</div>
                    </div>

                    <button
                      type="button"
                      className="wa-notif-tone-test-btn"
                      onClick={(e) => handleTestTone(e, tone.id)}
                      title="Escuchar prueba de sonido"
                    >
                      <Play size={14} fill="currentColor" />
                    </button>
                  </div>
                );
              })}

              {/* Silencioso */}
              {tonoSilencioso && (
                <div
                  className={`wa-notif-tone-row ${selectedTone === 'silent' ? 'selected' : ''}`}
                  onClick={() => setSelectedTone('silent')}
                >
                  <div className="wa-notif-radio-outer">
                    {selectedTone === 'silent' && <div className="wa-notif-radio-inner" />}
                  </div>
                  <div className="wa-notif-tone-emoji">{tonoSilencioso.icono}</div>
                  <div className="wa-notif-tone-info">
                    <span className="wa-notif-tone-name">{tonoSilencioso.nombre}</span>
                    <div className="wa-notif-tone-desc">{tonoSilencioso.desc}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN 5: SILENCIAMIENTO TEMPORAL */}
          <div className="wa-notif-section">
            <div className="wa-notif-section-title">
              <BellOff size={16} color="#54656f" />
              <span>Silenciar notificaciones de este chat</span>
            </div>

            <div className="wa-notif-mute-list">
              {MUTE_OPTIONS.map(opt => {
                const isSelected = muteOption === opt.id;
                return (
                  <div
                    key={opt.id}
                    className={`wa-notif-mute-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => setMuteOption(opt.id)}
                  >
                    <div className="wa-notif-radio-outer">
                      {isSelected && <div className="wa-notif-radio-inner" />}
                    </div>
                    <span className="wa-notif-mute-label">{opt.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="wa-notif-modal-footer">
          <button type="button" className="wa-notif-btn cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="wa-notif-btn submit"
            onClick={handleSave}
          >
            {savedSuccess ? (
              <>
                <Check size={16} /> ¡Preferencias guardadas!
              </>
            ) : (
              'Guardar preferencias'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInternoNotificationSettingsModal;
