import React from 'react';
import { User, Zap, Trash2, Box, Send, MessageCircle, Activity } from 'lucide-react';

const ChatWindow = ({ 
  conversacionActiva, 
  mensajes, 
  texto, 
  setTexto, 
  enviarMensaje, 
  cerrarConversacion, 
  eliminarConversacion, 
  messagesEndRef 
}) => {
  if (!conversacionActiva) {
    return (
      <div className="chat-window-panel">
        <div className="empty-chat">
          <div className="empty-content">
            <MessageCircle size={80} color="#bdc3c7" />
            <h2>Selecciona un chat</h2>
            <p>Elige una conversación para empezar.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window-panel">
      <div className="chat-header">
        <div className="header-info">
          <div className="avatar"><User size={24} color="#fff" /></div>
          <div>
            <h3>{conversacionActiva.nombre || conversacionActiva.username}</h3>
            <p className="status">{conversacionActiva.external_id}</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="agent-select">
            <User size={14} style={{ marginRight: '5px' }} />
            Agente Fibratec
          </button>
          <button className="icon-btn-gray" onClick={() => cerrarConversacion(conversacionActiva.id)}>
            <Zap size={18} />
          </button>
          <button className="icon-btn-gray" onClick={() => eliminarConversacion(conversacionActiva.id)}>
            <Trash2 size={18} color="#e74c3c" />
          </button>
        </div>
      </div>

      <div className="messages-container">
        {mensajes.map((m, idx) => {
          if (m.remitente === 'sistema' || m.remitente === 'sistema_info' || m.remitente === 'sistema_success') {
            const typeClass = m.remitente === 'sistema_info' ? 'info' : (m.remitente === 'sistema_success' ? 'success' : '');
            return (
              <div key={idx} className={`message-system ${typeClass}`}>
                {m.remitente === 'sistema_info' ? <Activity size={14} style={{ marginRight: '8px' }} /> : <Zap size={14} style={{ marginRight: '8px' }} />}
                {m.texto}
              </div>
            );
          }
          return (
            <div key={idx} className={`message-row ${m.remitente === 'user' ? 'received' : 'sent'}`}>
              <div className="message-bubble">
                {m.texto}
                <div className="message-time">
                  {new Date(m.created_at || m.fecha).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  {m.remitente !== 'user' && <span className="checks"> ✓✓</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <button className="icon-btn-gray"><Box size={20} /></button>
        <button className="icon-btn-gray"><Zap size={20} /></button>
        <input 
          type="text" 
          placeholder="Escribe un mensaje..." 
          value={texto} 
          onChange={(e) => setTexto(e.target.value)} 
          onKeyPress={(e) => e.key === 'Enter' && enviarMensaje()} 
        />
        <button className="send-button-circle" onClick={enviarMensaje}>
          <Send size={20} color="#fff" />
        </button>
      </div>
    </div>
  );
};

export default ChatWindow;
