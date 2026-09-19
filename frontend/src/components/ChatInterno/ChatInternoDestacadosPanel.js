import React, { useState, useEffect } from 'react';
import { ArrowLeft, X, Star, FileText } from 'lucide-react';
import { chatInternoService } from '../../services/chatInterno.service';
import { resolveAvatar, resolveMedia } from '../../services/api';
import { renderContentWithAppleEmojis } from '../../utils/appleEmojiHelper';

export default function ChatInternoDestacadosPanel({ canal, onVolver, onClose, userActual }) {
  const [mensajes, setMensajes] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!canal?.id) return;
    setCargando(true);
    chatInternoService.getMensajesDestacados(canal.id)
      .then(data => setMensajes(data || []))
      .catch(err => console.error(err))
      .finally(() => setCargando(false));
  }, [canal?.id]);

  const handleUnstar = async (msgId) => {
    try {
      await chatInternoService.toggleDestacarMensaje(msgId);
      setMensajes(prev => prev.filter(m => m.id !== msgId));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <aside className="ci-details-panel wa-info-panel">
      <div className="wa-info-header">
        <button type="button" className="wa-info-close-btn" onClick={onVolver} title="Volver">
          <ArrowLeft size={20} />
        </button>
        <span className="wa-info-header-title">Mensajes destacados</span>
        <button type="button" className="wa-info-close-btn" onClick={onClose} title="Cerrar">
          <X size={20} />
        </button>
      </div>

      <div className="wa-info-content-scroll" style={{ padding: '14px' }}>
        {cargando ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#8696a0' }}>
            <span className="media-spinner" style={{ width: '24px', height: '24px', margin: '0 auto 12px' }} />
            <div>Cargando mensajes destacados...</div>
          </div>
        ) : mensajes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8696a0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Star size={32} color="#8696a0" />
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#e9edef', marginBottom: 6 }}>No hay mensajes destacados</div>
            <div style={{ fontSize: '0.84rem', lineHeight: 1.4 }}>
              Pasa el cursor sobre un mensaje y haz clic en la flecha para destacarlo. Solo tú podrás ver tus mensajes destacados en esta conversación.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {mensajes.map(m => {
              const timeStr = new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
              const dateStr = new Date(m.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' });
              return (
                <div key={m.id} className="wa-destacado-card">
                  <div className="wa-destacado-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="wa-destacado-avatar">
                        {m.emisor_foto ? (
                          <img src={resolveAvatar(m.emisor_foto)} alt={m.emisor_nombre} />
                        ) : (
                          <div className="wa-avatar-placeholder-mini">
                            {m.emisor_nombre?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className="wa-destacado-sender">{m.emisor_nombre}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="wa-destacado-date">{dateStr}, {timeStr}</span>
                      <button
                        type="button"
                        className="wa-destacado-unstar-btn"
                        onClick={() => handleUnstar(m.id)}
                        title="Quitar de destacados"
                      >
                        <Star size={16} fill="#ffb020" color="#ffb020" />
                      </button>
                    </div>
                  </div>

                  <div className="wa-destacado-card-body">
                    {m.tipo === 'imagen' && m.url_adjunto && (
                      <div className="wa-destacado-img-wrap">
                        <img src={resolveMedia(m.url_adjunto)} alt="Adjunto" />
                      </div>
                    )}
                    {m.tipo === 'documento' && (
                      <div className="wa-destacado-doc-wrap">
                        <FileText size={18} color="#7f66ff" />
                        <span>{m.nombre_adjunto || 'Documento'}</span>
                      </div>
                    )}
                    {m.mensaje && (
                      <div className="wa-destacado-text">
                        {renderContentWithAppleEmojis(m.mensaje)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
