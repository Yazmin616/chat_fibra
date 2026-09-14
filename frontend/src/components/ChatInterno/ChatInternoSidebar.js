import React, { useState } from 'react';
import { Hash, Lock, Plus, Search, MessageSquare, Pin } from 'lucide-react';
import { resolveAvatar } from '../../services/api';

const ChatInternoSidebar = ({
  canales = [],
  contactos = [],
  canalActivo,
  onSeleccionarCanal,
  onAbrirDirecto,
  onAbrirModalCrearCanal,
  onToggleFijar,
  userActual,
}) => {
  const [busqueda, setBusqueda] = useState('');

  // Separar canales grupales y chats directos
  const canalesGrupales = canales.filter(c => c.tipo === 'canal');
  const chatsDirectos = canales.filter(c => c.tipo === 'directo');

  // Filtrado por búsqueda
  const term = busqueda.toLowerCase().trim();
  const canalesFiltrados = canalesGrupales.filter(c =>
    (c.nombre || '').toLowerCase().includes(term)
  );

  // Ordenar: Fijados primero
  const canalesOrdenados = [...canalesFiltrados].sort((a, b) => {
    if (a.fijado && !b.fijado) return -1;
    if (!a.fijado && b.fijado) return 1;
    return 0;
  });

  const contactosFiltrados = contactos.filter(c =>
    (c.nombre || '').toLowerCase().includes(term) ||
    (c.area || '').toLowerCase().includes(term)
  );

  // Ordenar contactos: Aquellos con chat directo fijado primero
  const contactosOrdenados = [...contactosFiltrados].sort((a, b) => {
    const directA = chatsDirectos.find(c => Number(c.otro_participante?.id) === Number(a.id));
    const directB = chatsDirectos.find(c => Number(c.otro_participante?.id) === Number(b.id));
    const fijadoA = directA?.fijado ? 1 : 0;
    const fijadoB = directB?.fijado ? 1 : 0;
    return fijadoB - fijadoA;
  });

  return (
    <aside className="ci-sidebar">
      <div className="ci-sidebar-header">
        <div className="ci-sidebar-title">
          <MessageSquare size={20} color="#2563eb" />
          <span>Chat Corporativo</span>
        </div>
        <button
          className="ci-btn-icon"
          title="Crear nuevo canal"
          onClick={onAbrirModalCrearCanal}
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="ci-search-box">
        <div className="ci-search-input-wrap">
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            placeholder="Buscar canal o compañero..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      <div className="ci-list-sections">
        {/* Sección: Canales Grupales */}
        <div className="ci-section-header">
          <span>Canales ({canalesOrdenados.length})</span>
        </div>

        {canalesOrdenados.map((canal) => {
          const isActive = canalActivo?.id === canal.id;
          return (
            <div
              key={`canal-${canal.id}`}
              className={`ci-item ${isActive ? 'active' : ''}`}
              onClick={() => onSeleccionarCanal(canal)}
              style={{ position: 'relative' }}
            >
              <div className="ci-item-icon">
                {canal.es_privado ? <Lock size={16} /> : <Hash size={16} />}
              </div>
              <div className="ci-item-info">
                <div className="ci-item-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>{canal.nombre}</span>
                  {canal.fijado && (
                    <Pin size={12} color="#2563eb" fill="#2563eb" style={{ transform: 'rotate(45deg)', flexShrink: 0 }} title="Fijado en la parte superior" />
                  )}
                  {canal.canal_eliminado ? (
                    <span style={{ fontSize: '0.68rem', color: '#e11d48', fontWeight: 600 }}>[Eliminado]</span>
                  ) : canal.soy_miembro_activo === false ? (
                    <span style={{ fontSize: '0.68rem', color: '#e11d48', fontWeight: 600 }}>[Archivado]</span>
                  ) : null}
                </div>
                {canal.ultimo_mensaje && (
                  <div className="ci-item-sub">
                    {canal.ultimo_mensaje.emisor_nombre?.split(' ')[0]}: {canal.ultimo_mensaje.mensaje || 'Archivo adjunto'}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {canal.unread_count > 0 && !isActive && (
                  <span className="ci-badge">{canal.unread_count}</span>
                )}
                {onToggleFijar && (
                  <button
                    type="button"
                    className="ci-btn-icon"
                    style={{
                      width: '24px',
                      height: '24px',
                      padding: 0,
                      opacity: canal.fijado ? 1 : 0.4,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                    title={canal.fijado ? 'Desfijar canal' : 'Fijar canal'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFijar(canal.id);
                    }}
                  >
                    <Pin size={13} color={canal.fijado ? '#2563eb' : '#64748b'} fill={canal.fijado ? '#2563eb' : 'none'} style={{ transform: 'rotate(45deg)' }} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Sección: Compañeros / Mensajes Directos */}
        <div className="ci-section-header" style={{ marginTop: '12px' }}>
          <span>Mensajes Directos</span>
        </div>

        {contactosOrdenados.map((contacto) => {
          // Buscar si ya existe un chat directo abierto con este contacto
          const directCanal = chatsDirectos.find(
            c => c.otro_participante?.id === contacto.id
          );
          const isActive = canalActivo?.id === directCanal?.id;
          const unread = directCanal?.unread_count || 0;
          const isPinned = directCanal?.fijado;

          return (
            <div
              key={`contacto-${contacto.id}`}
              className={`ci-item ${isActive ? 'active' : ''}`}
              onClick={() => {
                if (directCanal) {
                  onSeleccionarCanal(directCanal);
                } else {
                  onAbrirDirecto(contacto.id);
                }
              }}
              style={{ position: 'relative' }}
            >
              <div className="ci-item-avatar-wrap">
                {contacto.foto_perfil ? (
                  <img
                    src={resolveAvatar(contacto.foto_perfil)}
                    alt={contacto.nombre}
                    className="ci-avatar-img"
                  />
                ) : (
                  <div className="ci-avatar-placeholder">
                    {contacto.nombre.charAt(0).toUpperCase()}
                  </div>
                )}
                <div 
                  className={`ci-online-dot ${contacto.esta_online ? (contacto.estado_presencia || 'disponible') : 'offline'}`}
                  title={contacto.esta_online ? (
                    contacto.estado_presencia === 'reunion' ? 'En reunión' :
                    contacto.estado_presencia === 'ocupado' ? 'No molestar' :
                    contacto.estado_presencia === 'comida'  ? 'En comida' :
                    contacto.estado_presencia === 'ausente' ? 'Ausente' : 'Disponible'
                  ) : 'Desconectado'}
                />
              </div>

              <div className="ci-item-info">
                <div className="ci-item-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>{contacto.nombre}</span>
                  {isPinned && (
                    <Pin size={12} color="#2563eb" fill="#2563eb" style={{ transform: 'rotate(45deg)', flexShrink: 0 }} title="Fijado en la parte superior" />
                  )}
                  {contacto.esta_online && contacto.estado_presencia && contacto.estado_presencia !== 'disponible' && (
                    <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(0,0,0,0.06)', color: '#475569', fontWeight: 500 }}>
                      {contacto.estado_presencia === 'reunion' && 'En reunión'}
                      {contacto.estado_presencia === 'ocupado' && 'No molestar'}
                      {contacto.estado_presencia === 'comida' && 'En comida'}
                      {contacto.estado_presencia === 'ausente' && 'Ausente'}
                    </span>
                  )}
                </div>
                <div className="ci-item-sub">
                  {directCanal?.ultimo_mensaje ? (
                    `${directCanal.ultimo_mensaje.mensaje || 'Archivo adjunto'}`
                  ) : (
                    contacto.area || contacto.rol
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {unread > 0 && !isActive && (
                  <span className="ci-badge">{unread}</span>
                )}
                {directCanal && onToggleFijar && (
                  <button
                    type="button"
                    className="ci-btn-icon"
                    style={{
                      width: '24px',
                      height: '24px',
                      padding: 0,
                      opacity: isPinned ? 1 : 0.4,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                    title={isPinned ? 'Desfijar chat' : 'Fijar chat'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFijar(directCanal.id);
                    }}
                  >
                    <Pin size={13} color={isPinned ? '#2563eb' : '#64748b'} fill={isPinned ? '#2563eb' : 'none'} style={{ transform: 'rotate(45deg)' }} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default ChatInternoSidebar;
