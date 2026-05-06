import React from 'react';
import { User, Filter } from 'lucide-react';

const ChatList = ({ 
  conversaciones, 
  conversacionActiva, 
  setConversacionActiva, 
  cargarMensajes, 
  busqueda, 
  setBusqueda, 
  filtro, 
  setFiltro 
}) => {
  return (
    <div className="chat-list-panel">
      <div className="search-container">
        <div className="search-box">
          <input 
            type="text" 
            placeholder="Busca un chat" 
            value={busqueda} 
            onChange={(e) => setBusqueda(e.target.value)} 
          />
          <Filter size={18} className="search-icon" />
        </div>
      </div>
      <div className="filter-tabs">
        {["Todos los chats", "Abiertos", "Mis Asignados"].map(tab => (
          <button 
            key={tab} 
            className={`tab-pill ${filtro === tab ? 'active' : ''}`} 
            onClick={() => setFiltro(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="conversations-list">
        {conversaciones.map(c => (
          <div 
            key={c.id} 
            className={`conversation-item ${conversacionActiva?.id === c.id ? 'active' : ''}`} 
            onClick={() => { 
              setConversacionActiva(c); 
              cargarMensajes(c.usuario_id); 
            }}
          >
            <div className="avatar"><User size={20} color="#fff" /></div>
            <div className="conv-info">
              <div className="conv-header">
                <span className="client-name">{c.nombre || c.username}</span>
                <span className="time">
                  {c.updated_at ? new Date(c.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                </span>
              </div>
              <div className="last-message">{c.ultimo_mensaje || "Sin mensajes"}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatList;
