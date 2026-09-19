import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArrowLeft, X, Search, Image as ImageIcon, Video, FileText,
  Link2, Mic, Sparkles, Download, ExternalLink, Copy, Check,
  Play, Pause, ChevronLeft, ChevronRight, File, Heart
} from 'lucide-react';
import { resolveMedia, API_URL } from '../../services/api';

// Formato amigable de tamaño de archivo (Bytes, KB, MB)
const formatFileSize = (bytes) => {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Formato de fecha para lista
const formatItemDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) {
    return `Hoy, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) {
    return `Ayer, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== hoy.getFullYear() ? 'numeric' : undefined
  });
};

// Formato de duración en segundos (mm:ss)
const formatAudioTime = (seconds) => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

// Helper para detectar tipo de documento y color de icono
const getDocDetails = (filename = '') => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') {
    return { ext: 'PDF', bg: '#fee2e2', color: '#dc2626' };
  }
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) {
    return { ext: ext.toUpperCase(), bg: '#e0f2fe', color: '#0284c7' };
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return { ext: ext.toUpperCase(), bg: '#dcfce7', color: '#16a34a' };
  }
  if (['ppt', 'pptx'].includes(ext)) {
    return { ext: ext.toUpperCase(), bg: '#ffedd5', color: '#ea580c' };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return { ext: ext.toUpperCase(), bg: '#fef3c7', color: '#d97706' };
  }
  return { ext: ext.toUpperCase() || 'FILE', bg: '#f1f5f9', color: '#64748b' };
};

const ChatInternoMediaGallery = ({
  canal,
  archivos = [],
  onVolver,
  onClose,
  userActual,
}) => {
  const [tabActiva, setTabActiva] = useState('multimedia');
  const [busqueda, setBusqueda] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [copiadoUrl, setCopiadoUrl] = useState(null);
  const [stickerGuardado, setStickerGuardado] = useState(null);

  // Estado del reproductor de audio integrado
  const [audioActivoId, setAudioActivoId] = useState(null);
  const [audioReproduciendo, setAudioReproduciendo] = useState(false);
  const [audioTiempoActual, setAudioTiempoActual] = useState(0);
  const [audioDuracion, setAudioDuracion] = useState(0);
  const audioRef = useRef(null);

  // Clasificación estricta de elementos
  const {
    multimediaList,
    documentosList,
    enlacesList,
    audiosList,
    stickersList,
    otrosList
  } = useMemo(() => {
    const multi = [];
    const docs = [];
    const links = [];
    const audios = [];
    const stickers = [];
    const otros = [];

    const regexUrl = /(https?:\/\/[^\s]+)/gi;

    archivos.forEach(item => {
      const url = item.url_adjunto || '';
      const name = (item.nombre_adjunto || '').toLowerCase();
      const tipo = (item.tipo || '').toLowerCase();
      const text = item.mensaje || '';

      // 1. Extraer enlaces de mensajes de texto
      if (text) {
        const matches = text.match(regexUrl);
        if (matches && matches.length > 0) {
          matches.forEach((matchedUrl, idx) => {
            links.push({
              id: `${item.id}-link-${idx}`,
              url: matchedUrl,
              mensaje: text,
              emisor_nombre: item.emisor_nombre || 'Usuario',
              created_at: item.created_at,
              emisor_id: item.emisor_id
            });
          });
        }
      }

      // 2. Clasificar Stickers
      const isSticker = tipo === 'sticker' ||
        url.startsWith('st://') ||
        url.includes('/stickers/') ||
        name === 'sticker.webp';

      if (isSticker) {
        stickers.push(item);
        return;
      }

      // 3. Clasificar Audios y Notas de voz
      const isAudio = tipo === 'audio' ||
        /\.(webm|mp3|ogg|wav|m4a|aac)(\?.*)?$/i.test(url) ||
        /\.(webm|mp3|ogg|wav|m4a|aac)$/i.test(name);

      if (isAudio) {
        audios.push(item);
        return;
      }

      // 4. Clasificar Multimedia (Fotos y Videos)
      const isVideo = tipo === 'video' ||
        /\.(mp4|webm|mov|mkv|avi)(\?.*)?$/i.test(url) ||
        /\.(mp4|mov|mkv|avi)$/i.test(name);

      const isImage = tipo === 'imagen' ||
        /\.(jpg|jpeg|png|webp|gif|svg|bmp)(\?.*)?$/i.test(url) ||
        /\.(jpg|jpeg|png|webp|gif|svg|bmp)$/i.test(name);

      if (isVideo || isImage) {
        multi.push({ ...item, isVideo });
        return;
      }

      // 5. Clasificar Documentos
      const isDoc = tipo === 'documento' || tipo === 'archivo' ||
        /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|7z|tar|gz)$/i.test(name);

      if (isDoc) {
        docs.push(item);
        return;
      }

      // 6. Otros archivos adjuntos
      if (url) {
        otros.push(item);
      }
    });

    return {
      multimediaList: multi,
      documentosList: docs,
      enlacesList: links,
      audiosList: audios,
      stickersList: stickers,
      otrosList: otros
    };
  }, [archivos]);

  // Filtrado por buscador según pestaña activa
  const itemsFiltrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    let currentList = [];

    switch (tabActiva) {
      case 'multimedia': currentList = multimediaList; break;
      case 'documentos': currentList = documentosList; break;
      case 'enlaces':    currentList = enlacesList; break;
      case 'audios':     currentList = audiosList; break;
      case 'stickers':   currentList = stickersList; break;
      case 'otros':      currentList = otrosList; break;
      default:           currentList = multimediaList;
    }

    if (!term) return currentList;

    return currentList.filter(item => {
      const name = (item.nombre_adjunto || '').toLowerCase();
      const text = (item.mensaje || '').toLowerCase();
      const sender = (item.emisor_nombre || '').toLowerCase();
      const link = (item.url || item.url_adjunto || '').toLowerCase();
      return name.includes(term) || text.includes(term) || sender.includes(term) || link.includes(term);
    });
  }, [tabActiva, busqueda, multimediaList, documentosList, enlacesList, audiosList, stickersList, otrosList]);

  // Manejo de Lightbox con teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') {
        setLightboxIndex(null);
      } else if (e.key === 'ArrowLeft') {
        setLightboxIndex(prev => (prev > 0 ? prev - 1 : multimediaList.length - 1));
      } else if (e.key === 'ArrowRight') {
        setLightboxIndex(prev => (prev < multimediaList.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, multimediaList.length]);

  // Manejo de Audio
  const handleToggleAudio = (item) => {
    if (audioActivoId === item.id) {
      if (audioRef.current) {
        if (audioReproduciendo) {
          audioRef.current.pause();
          setAudioReproduciendo(false);
        } else {
          audioRef.current.play();
          setAudioReproduciendo(true);
        }
      }
    } else {
      setAudioActivoId(item.id);
      setAudioTiempoActual(0);
      setAudioReproduciendo(true);
      if (audioRef.current) {
        audioRef.current.src = resolveMedia(item.url_adjunto);
        audioRef.current.play().catch(e => console.error('Audio play error:', e));
      }
    }
  };

  const handleAudioSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setAudioTiempoActual(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  // Copiar URL al portapapeles
  const handleCopiarEnlace = (url) => {
    navigator.clipboard.writeText(url);
    setCopiadoUrl(url);
    setTimeout(() => setCopiadoUrl(null), 2000);
  };

  // Guardar sticker en favoritos
  const handleGuardarSticker = async (sticker) => {
    try {
      const token = localStorage.getItem('agente_token') || '';
      const url = sticker.url_adjunto;
      await fetch(`${API_URL}/agente/stickers/favoritos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sticker_url: url })
      });
      setStickerGuardado(sticker.id);
      setTimeout(() => setStickerGuardado(null), 2500);
    } catch (err) {
      console.error('Error al guardar sticker en favoritos:', err);
    }
  };

  const lightboxItem = lightboxIndex !== null ? multimediaList[lightboxIndex] : null;

  return (
    <aside className="ci-details-panel wa-info-panel wa-media-gallery-panel">
      {/* Audio oculto para reproducción */}
      <audio
        ref={audioRef}
        onTimeUpdate={() => setAudioTiempoActual(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setAudioDuracion(audioRef.current?.duration || 0)}
        onEnded={() => {
          setAudioReproduciendo(false);
          setAudioTiempoActual(0);
        }}
        onError={() => setAudioReproduciendo(false)}
      />

      {/* Cabecera estilo WhatsApp */}
      <div className="wa-info-header wa-media-header">
        <button
          type="button"
          className="wa-info-close-btn wa-media-back-btn"
          onClick={onVolver}
          title="Regresar a información"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="wa-info-header-title">Archivos, enlaces y documentos</span>
        <button
          type="button"
          className="wa-info-close-btn"
          onClick={onClose}
          title="Cerrar panel"
          style={{ marginLeft: 'auto' }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Barra de pestañas con contadores */}
      <div className="wa-media-tabs-bar">
        <button
          type="button"
          className={`wa-media-tab-btn ${tabActiva === 'multimedia' ? 'active' : ''}`}
          onClick={() => setTabActiva('multimedia')}
        >
          <span>Multimedia</span>
          <span className="wa-media-tab-badge">{multimediaList.length}</span>
        </button>

        <button
          type="button"
          className={`wa-media-tab-btn ${tabActiva === 'documentos' ? 'active' : ''}`}
          onClick={() => setTabActiva('documentos')}
        >
          <span>Documentos</span>
          <span className="wa-media-tab-badge">{documentosList.length}</span>
        </button>

        <button
          type="button"
          className={`wa-media-tab-btn ${tabActiva === 'enlaces' ? 'active' : ''}`}
          onClick={() => setTabActiva('enlaces')}
        >
          <span>Enlaces</span>
          <span className="wa-media-tab-badge">{enlacesList.length}</span>
        </button>

        <button
          type="button"
          className={`wa-media-tab-btn ${tabActiva === 'audios' ? 'active' : ''}`}
          onClick={() => setTabActiva('audios')}
        >
          <span>Audios</span>
          <span className="wa-media-tab-badge">{audiosList.length}</span>
        </button>

        <button
          type="button"
          className={`wa-media-tab-btn ${tabActiva === 'stickers' ? 'active' : ''}`}
          onClick={() => setTabActiva('stickers')}
        >
          <span>Stickers</span>
          <span className="wa-media-tab-badge">{stickersList.length}</span>
        </button>

        {otrosList.length > 0 && (
          <button
            type="button"
            className={`wa-media-tab-btn ${tabActiva === 'otros' ? 'active' : ''}`}
            onClick={() => setTabActiva('otros')}
          >
            <span>Otros</span>
            <span className="wa-media-tab-badge">{otrosList.length}</span>
          </button>
        )}
      </div>

      {/* Barra de búsqueda por texto dentro de la categoría */}
      <div className="wa-media-search-wrap">
        <Search size={16} className="wa-media-search-icon" />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={`Buscar en ${tabActiva}...`}
          className="wa-media-search-input"
        />
        {busqueda && (
          <button
            type="button"
            className="wa-media-search-clear"
            onClick={() => setBusqueda('')}
            title="Limpiar búsqueda"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Contenido scrolleable de la galería */}
      <div className="wa-info-content-scroll wa-media-content-scroll">
        {itemsFiltrados.length === 0 ? (
          <div className="wa-media-empty-state">
            {tabActiva === 'multimedia' && <ImageIcon size={44} className="wa-media-empty-icon" />}
            {tabActiva === 'documentos' && <FileText size={44} className="wa-media-empty-icon" />}
            {tabActiva === 'enlaces' && <Link2 size={44} className="wa-media-empty-icon" />}
            {tabActiva === 'audios' && <Mic size={44} className="wa-media-empty-icon" />}
            {tabActiva === 'stickers' && <Sparkles size={44} className="wa-media-empty-icon" />}
            {tabActiva === 'otros' && <File size={44} className="wa-media-empty-icon" />}

            <p className="wa-media-empty-text">
              {busqueda
                ? `No se encontraron resultados para "${busqueda}"`
                : `No hay ${tabActiva} en esta conversación`}
            </p>
          </div>
        ) : (
          <>
            {/* ================= PESTAÑA: MULTIMEDIA ================= */}
            {tabActiva === 'multimedia' && (
              <div className="wa-media-grid">
                {itemsFiltrados.map((item, idx) => {
                  const mediaSrc = resolveMedia(item.url_adjunto);
                  return (
                    <div
                      key={item.id}
                      className="wa-media-grid-item"
                      onClick={() => setLightboxIndex(idx)}
                      title={`${item.nombre_adjunto || 'Archivo multimedia'} • ${formatItemDate(item.created_at)}`}
                    >
                      {item.isVideo ? (
                        <div className="wa-media-video-thumb">
                          <video src={mediaSrc} preload="metadata" />
                          <div className="wa-media-video-badge">
                            <Video size={13} />
                          </div>
                        </div>
                      ) : (
                        <img
                          src={mediaSrc}
                          alt={item.nombre_adjunto || 'Foto'}
                          loading="lazy"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ================= PESTAÑA: DOCUMENTOS ================= */}
            {tabActiva === 'documentos' && (
              <div className="wa-docs-list">
                {itemsFiltrados.map(item => {
                  const docInfo = getDocDetails(item.nombre_adjunto);
                  const fileUrl = resolveMedia(item.url_adjunto);
                  return (
                    <div key={item.id} className="wa-doc-item">
                      <div
                        className="wa-doc-icon-badge"
                        style={{ background: docInfo.bg, color: docInfo.color }}
                      >
                        <FileText size={20} />
                        <span className="wa-doc-ext-tag">{docInfo.ext}</span>
                      </div>

                      <div className="wa-doc-details">
                        <div className="wa-doc-name" title={item.nombre_adjunto}>
                          {item.nombre_adjunto || 'Documento'}
                        </div>
                        <div className="wa-doc-meta">
                          <span>{formatFileSize(item.tamano_adjunto)}</span>
                          {item.tamano_adjunto && <span>•</span>}
                          <span>{formatItemDate(item.created_at)}</span>
                          <span>•</span>
                          <span className="wa-doc-sender">{item.emisor_nombre}</span>
                        </div>
                      </div>

                      <a
                        href={fileUrl}
                        download={item.nombre_adjunto || 'documento'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="wa-doc-download-btn"
                        title="Descargar archivo"
                      >
                        <Download size={18} />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ================= PESTAÑA: ENLACES ================= */}
            {tabActiva === 'enlaces' && (
              <div className="wa-links-list">
                {itemsFiltrados.map(link => {
                  let hostname = '';
                  try {
                    hostname = new URL(link.url).hostname;
                  } catch {
                    hostname = link.url;
                  }

                  return (
                    <div key={link.id} className="wa-link-item">
                      <div className="wa-link-icon-circle">
                        <Link2 size={18} />
                      </div>

                      <div className="wa-link-details">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="wa-link-url"
                          title={link.url}
                        >
                          {link.url}
                          <ExternalLink size={12} className="wa-link-external-icon" />
                        </a>
                        <div className="wa-link-host">{hostname}</div>
                        {link.mensaje && link.mensaje !== link.url && (
                          <div className="wa-link-snippet">
                            {link.mensaje.replace(link.url, '').trim().slice(0, 90)}
                          </div>
                        )}
                        <div className="wa-link-meta">
                          <span>{formatItemDate(link.created_at)}</span>
                          <span>•</span>
                          <span>{link.emisor_nombre}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="wa-link-copy-btn"
                        onClick={() => handleCopiarEnlace(link.url)}
                        title="Copiar enlace"
                      >
                        {copiadoUrl === link.url ? <Check size={16} color="#00a884" /> : <Copy size={16} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ================= PESTAÑA: AUDIOS ================= */}
            {tabActiva === 'audios' && (
              <div className="wa-audios-list">
                {itemsFiltrados.map(audio => {
                  const esEste = audioActivoId === audio.id;
                  const reproduciendo = esEste && audioReproduciendo;
                  const audioSrc = resolveMedia(audio.url_adjunto);

                  return (
                    <div key={audio.id} className={`wa-audio-item ${esEste ? 'active' : ''}`}>
                      <button
                        type="button"
                        className="wa-audio-play-circle-btn"
                        onClick={() => handleToggleAudio(audio)}
                        title={reproduciendo ? 'Pausar audio' : 'Reproducir audio'}
                      >
                        {reproduciendo ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
                      </button>

                      <div className="wa-audio-track-info">
                        <div className="wa-audio-slider-wrap">
                          <input
                            type="range"
                            min="0"
                            max={esEste && audioDuracion ? audioDuracion : 100}
                            step="0.1"
                            value={esEste ? audioTiempoActual : 0}
                            onChange={handleAudioSeek}
                            className="wa-audio-slider"
                          />
                        </div>

                        <div className="wa-audio-meta-row">
                          <span className="wa-audio-time">
                            {esEste
                              ? `${formatAudioTime(audioTiempoActual)} / ${formatAudioTime(audioDuracion)}`
                              : (audio.nombre_adjunto?.includes('Nota de voz') ? 'Nota de voz' : 'Audio')}
                          </span>
                          <span>•</span>
                          <span>{formatItemDate(audio.created_at)}</span>
                          <span>•</span>
                          <span className="wa-audio-sender">{audio.emisor_nombre}</span>
                        </div>
                      </div>

                      <a
                        href={audioSrc}
                        download={audio.nombre_adjunto || 'audio.webm'}
                        className="wa-audio-download-btn"
                        title="Descargar audio"
                      >
                        <Download size={16} />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ================= PESTAÑA: STICKERS ================= */}
            {tabActiva === 'stickers' && (
              <div className="wa-stickers-grid">
                {itemsFiltrados.map(stk => {
                  const stickerSrc = resolveMedia(stk.url_adjunto);
                  const guardado = stickerGuardado === stk.id;

                  return (
                    <div key={stk.id} className="wa-sticker-grid-cell">
                      <div className="wa-sticker-grid-preview" title={`Enviado por ${stk.emisor_nombre} • ${formatItemDate(stk.created_at)}`}>
                        <img src={stickerSrc} alt="Sticker" loading="lazy" />
                      </div>

                      <button
                        type="button"
                        className={`wa-sticker-fav-btn ${guardado ? 'saved' : ''}`}
                        onClick={() => handleGuardarSticker(stk)}
                        title={guardado ? '¡Guardado en mis stickers!' : 'Guardar en mis stickers'}
                      >
                        {guardado ? <Check size={14} color="#00a884" /> : <Heart size={14} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ================= PESTAÑA: OTROS ================= */}
            {tabActiva === 'otros' && (
              <div className="wa-docs-list">
                {itemsFiltrados.map(item => (
                  <div key={item.id} className="wa-doc-item">
                    <div className="wa-doc-icon-badge" style={{ background: '#f1f5f9', color: '#64748b' }}>
                      <File size={20} />
                    </div>
                    <div className="wa-doc-details">
                      <div className="wa-doc-name">{item.nombre_adjunto || 'Archivo'}</div>
                      <div className="wa-doc-meta">
                        <span>{formatFileSize(item.tamano_adjunto)}</span>
                        <span>•</span>
                        <span>{formatItemDate(item.created_at)}</span>
                        <span>•</span>
                        <span>{item.emisor_nombre}</span>
                      </div>
                    </div>
                    <a
                      href={resolveMedia(item.url_adjunto)}
                      download={item.nombre_adjunto || 'archivo'}
                      className="wa-doc-download-btn"
                      title="Descargar"
                    >
                      <Download size={18} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ========================================================
          LIGHTBOX / MODAL EN PANTALLA COMPLETA PARA FOTOS Y VIDEOS
      ======================================================== */}
      {lightboxItem && (
        <div className="wa-lightbox-overlay" onClick={() => setLightboxIndex(null)}>
          <div className="wa-lightbox-container" onClick={(e) => e.stopPropagation()}>
            {/* Header del lightbox */}
            <div className="wa-lightbox-header">
              <div className="wa-lightbox-title-wrap">
                <span className="wa-lightbox-filename">
                  {lightboxItem.nombre_adjunto || (lightboxItem.isVideo ? 'Video' : 'Imagen')}
                </span>
                <span className="wa-lightbox-meta">
                  {formatItemDate(lightboxItem.created_at)} • {lightboxItem.emisor_nombre}
                </span>
              </div>

              <div className="wa-lightbox-actions">
                <a
                  href={resolveMedia(lightboxItem.url_adjunto)}
                  download={lightboxItem.nombre_adjunto || 'descarga'}
                  className="wa-lightbox-btn"
                  title="Descargar"
                >
                  <Download size={20} />
                </a>
                <button
                  type="button"
                  className="wa-lightbox-btn"
                  onClick={() => setLightboxIndex(null)}
                  title="Cerrar (Esc)"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Contenido principal imagen o video */}
            <div className="wa-lightbox-body">
              {lightboxItem.isVideo ? (
                <video
                  src={resolveMedia(lightboxItem.url_adjunto)}
                  controls
                  autoPlay
                  className="wa-lightbox-video"
                />
              ) : (
                <img
                  src={resolveMedia(lightboxItem.url_adjunto)}
                  alt={lightboxItem.nombre_adjunto || 'Foto ampliada'}
                  className="wa-lightbox-img"
                />
              )}

              {/* Botón Anterior */}
              {multimediaList.length > 1 && (
                <button
                  type="button"
                  className="wa-lightbox-nav-btn prev"
                  onClick={() => setLightboxIndex(prev => (prev > 0 ? prev - 1 : multimediaList.length - 1))}
                  title="Anterior"
                >
                  <ChevronLeft size={28} />
                </button>
              )}

              {/* Botón Siguiente */}
              {multimediaList.length > 1 && (
                <button
                  type="button"
                  className="wa-lightbox-nav-btn next"
                  onClick={() => setLightboxIndex(prev => (prev < multimediaList.length - 1 ? prev + 1 : 0))}
                  title="Siguiente"
                >
                  <ChevronRight size={28} />
                </button>
              )}
            </div>

            {/* Pie de foto o pie con contador */}
            <div className="wa-lightbox-footer">
              <span>{lightboxIndex + 1} de {multimediaList.length}</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default ChatInternoMediaGallery;
