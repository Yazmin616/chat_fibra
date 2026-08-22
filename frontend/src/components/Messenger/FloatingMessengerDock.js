import React, { useState, useEffect, useRef } from 'react';
import { Minus, X, Maximize2, Send, ThumbsUp, Hash } from 'lucide-react';
import { API_URL, resolveAvatar } from '../../services/api';
import { chatInternoService } from '../../services/chatInterno.service';

const FloatingMessengerDock = ({
  miniChat,
  onClose,
  onMinimize,
  onExpand,
  socket,
  userActual,
}) => {
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const messagesEndRef = useRef(null);

  // Cargar mensajes cuando se abre un canal
  useEffect(() => {
    if (!miniChat.isOpen || !miniChat.canalId) return;

    let cancel = false;
    const cargar = async () => {
      try {
        setCargando(true);
        const data = await chatInternoService.getMensajes(miniChat.canalId, 30);
        if (!cancel) {
          setMensajes(data.mensajes || []);
        }
      } catch (err) {
        console.error('Error al cargar mensajes en mini chat:', err);
      } finally {
        if (!cancel) setCargando(false);
      }
    };

    cargar();

    if (socket) {
      socket.emit('chat_interno:join_canal', { canalId: miniChat.canalId, agenteId: userActual?.id });
    }

    return () => {
      cancel = true;
      if (socket) {
        socket.emit('chat_interno:leave_canal', { canalId: miniChat.canalId });
      }
    };
  }, [miniChat.isOpen, miniChat.canalId, socket, userActual]);

  // Escuchar nuevos mensajes por socket
  useEffect(() => {
    if (!socket || !miniChat.isOpen || !miniChat.canalId) return;

    const handleNuevo = ({ canalId, mensaje }) => {
      if (canalId === miniChat.canalId) {
        setMensajes(prev => {
          if (prev.some(m => m.id === mensaje.id)) return prev;
          return [...prev, mensaje];
        });
        if (mensaje.emisor_id !== userActual?.id) {
          chatInternoService.marcarLeido(canalId, mensaje.id).catch(() => {});
        }
      }
    };

    socket.on('chat_interno:nuevo_mensaje', handleNuevo);
    return () => {
      socket.off('chat_interno:nuevo_mensaje', handleNuevo);
    };
  }, [socket, miniChat.isOpen, miniChat.canalId, userActual]);

  // Auto-scroll
  useEffect(() => {
    if (!miniChat.isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes, miniChat.isMinimized]);

  if (!miniChat.isOpen) return null;

  const handleSend = async (textoAEnviar = texto) => {
    if (enviando || !textoAEnviar.trim() || !miniChat.canalId) return;
    try {
      setEnviando(true);
      const nuevo = await chatInternoService.enviarMensajeTexto(miniChat.canalId, textoAEnviar.trim());
      setMensajes(prev => {
        if (prev.some(m => m.id === nuevo.id)) return prev;
        return [...prev, nuevo];
      });
      setTexto('');
    } catch (err) {
      console.error('Error al enviar en mini chat:', err);
    } finally {
      setEnviando(false);
    }
  };

  const otro = miniChat.otroUsuario;

  /* ================= ESTADO MINIMIZADO (Burbuja Chat Head) ================= */
  if (miniChat.isMinimized) {
    return (
      <div className="fb-chat-head-bubble" onClick={onMinimize} title={miniChat.canalNombre || 'Abrir chat'}>
        <div className="fb-chat-head-avatar-wrap">
          {otro?.foto_perfil ? (
            <img src={resolveAvatar(otro.foto_perfil)} alt="Avatar" />
          ) : (
            <div className="fb-chat-head-placeholder">
              {miniChat.canalNombre ? miniChat.canalNombre.charAt(0).toUpperCase() : 'C'}
            </div>
          )}
          <div className="fb-chat-head-online-dot" />
        </div>
        <button
          className="fb-chat-head-close-btn"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          title="Cerrar"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  /* ================= ESTADO ABIERTO (Ventana Messenger) ================= */
  return (
    <div className="fb-messenger-dock">
      {/* Cabecera estilo Messenger */}
      <div className="fb-messenger-header">
        <div className="fb-messenger-header-info">
          <div className="fb-messenger-avatar-wrap">
            {otro?.foto_perfil ? (
              <img src={resolveAvatar(otro.foto_perfil)} alt={miniChat.canalNombre} />
            ) : (
              <div className="fb-messenger-avatar-placeholder">
                {miniChat.tipo === 'canal' ? <Hash size={14} /> : (miniChat.canalNombre?.charAt(0) || 'U')}
              </div>
            )}
            <div className="fb-messenger-online-dot" />
          </div>

          <div className="fb-messenger-titles">
            <span className="fb-messenger-name">{miniChat.canalNombre || 'Chat'}</span>
            <span className="fb-messenger-status">
              {miniChat.tipo === 'canal' ? 'Canal interno' : 'Activo ahora'}
            </span>
          </div>
        </div>

        <div className="fb-messenger-header-actions">
          <button className="fb-messenger-btn" onClick={onExpand} title="Abrir en pantalla completa">
            <Maximize2 size={14} />
          </button>
          <button className="fb-messenger-btn" onClick={onMinimize} title="Minimizar">
            <Minus size={15} />
          </button>
          <button className="fb-messenger-btn" onClick={onClose} title="Cerrar">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Cuerpo de Mensajes */}
      <div className="fb-messenger-body">
        {cargando ? (
          <div className="fb-messenger-loading">Cargando...</div>
        ) : mensajes.length === 0 ? (
          <div className="fb-messenger-empty">
            <p>Saluda a tu compañero 👋</p>
          </div>
        ) : (
          mensajes.map((m) => {
            const isOwn = Number(m.emisor_id) === Number(userActual?.id);
            return (
              <div key={m.id} className={`fb-msg-row ${isOwn ? 'own' : ''}`}>
                {!isOwn && (
                  <div className="fb-msg-avatar">
                    {m.emisor_foto ? (
                      <img src={resolveAvatar(m.emisor_foto)} alt={m.emisor_nombre} />
                    ) : (
                      <div className="fb-msg-avatar-placeholder">
                        {m.emisor_nombre ? m.emisor_nombre.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                  </div>
                )}
                <div className="fb-msg-bubble">
                  {m.mensaje}
                  {m.tipo === 'imagen' && m.url_adjunto && (
                    <img src={`${API_URL}${m.url_adjunto}`} alt="Adjunto" className="fb-msg-img" />
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Barra de Entrada Messenger */}
      <div className="fb-messenger-footer">
        <input
          type="text"
          className="fb-messenger-input"
          placeholder="Escribe un mensaje..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />

        {texto.trim() ? (
          <button
            className="fb-messenger-send-btn active"
            onClick={() => handleSend()}
            disabled={enviando}
            title="Enviar"
          >
            <Send size={15} />
          </button>
        ) : (
          <button
            className="fb-messenger-like-btn"
            onClick={() => handleSend('👍')}
            title="Enviar pulgar arriba"
          >
            <ThumbsUp size={16} color="#0084ff" />
          </button>
        )}
      </div>
    </div>
  );
};

export default FloatingMessengerDock;
