import React, { useMemo } from 'react';
import { BellOff, CheckCheck, Trash2, MessageSquare, ShieldAlert, X, Hash } from 'lucide-react';
import { resolveAvatar } from '../../services/api';

function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const now = new Date();
  const date = new Date(isoString);
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Hace un momento';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Hace ${diffDays} d`;
  return date.toLocaleDateString();
}

const NotificationDropdown = ({
  notificaciones,
  onClose,
  onMarcarLeida,
  onMarcarTodasLeidas,
  onEliminarNotificacion,
  onLimpiarTodas,
  onSelectNotificacion,
}) => {
  // Deduplicar estrictamente por canalId para evitar entradas duplicadas en UI
  const notificacionesUnicas = useMemo(() => {
    const seenCanalIds = new Set();
    return notificaciones.filter(n => {
      if (!n.canalId) return true;
      const cid = Number(n.canalId);
      if (seenCanalIds.has(cid)) return false;
      seenCanalIds.add(cid);
      return true;
    });
  }, [notificaciones]);

  const unreadCount = notificacionesUnicas.filter(n => !n.leida).length;

  return (
    <div className="fb-notif-dropdown" onClick={(e) => e.stopPropagation()}>
      {/* Cabecera estilo Facebook */}
      <div className="fb-notif-header">
        <div className="fb-notif-title-wrap">
          <h3 className="fb-notif-title">Notificaciones</h3>
          {unreadCount > 0 && <span className="fb-notif-unread-count">{unreadCount} {unreadCount === 1 ? 'nueva' : 'nuevas'}</span>}
        </div>

        <div className="fb-notif-actions">
          {unreadCount > 0 && (
            <button
              className="fb-notif-action-btn"
              onClick={onMarcarTodasLeidas}
              title="Marcar todas como leídas"
            >
              <CheckCheck size={16} />
              <span>Marcar leídas</span>
            </button>
          )}

          {notificacionesUnicas.length > 0 && (
            <button
              className="fb-notif-action-btn"
              onClick={onLimpiarTodas}
              title="Limpiar todas"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Lista de Notificaciones */}
      <div className="fb-notif-list">
        {notificacionesUnicas.length === 0 ? (
          <div className="fb-notif-empty">
            <BellOff size={36} color="#94a3b8" />
            <p>No tienes notificaciones por el momento.</p>
          </div>
        ) : (
          notificacionesUnicas.map((notif) => {
            const esCanal = notif.canalTipo === 'canal' || (notif.canalTipo !== 'directo' && notif.titulo?.startsWith('#'));

            return (
              <div
                key={notif.id}
                className={`fb-notif-item ${!notif.leida ? 'unread' : ''}`}
                onClick={() => {
                  onMarcarLeida(notif.id);
                  if (onSelectNotificacion) {
                    onSelectNotificacion(notif);
                  }
                }}
              >
                {/* Avatar con badge flotante de tipo de evento */}
                <div className="fb-notif-avatar-wrap">
                  {notif.emisor_foto ? (
                    <img
                      src={resolveAvatar(notif.emisor_foto)}
                      alt={notif.titulo}
                      className="fb-notif-avatar"
                    />
                  ) : (
                    <div className={`fb-notif-avatar-placeholder ${esCanal ? 'channel-bg' : 'user-bg'}`}>
                      {esCanal ? (
                        <Hash size={20} color="#fff" />
                      ) : (
                        (notif.titulo?.charAt(0) || 'U').toUpperCase()
                      )}
                    </div>
                  )}

                  <div className={`fb-notif-badge-icon ${notif.tipo || 'mensaje'}`}>
                    {notif.tipo === 'miembro_removido' || notif.tipo === 'canal_cerrado' ? (
                      <ShieldAlert size={10} color="#fff" />
                    ) : esCanal ? (
                      <Hash size={10} color="#fff" />
                    ) : (
                      <MessageSquare size={10} color="#fff" />
                    )}
                  </div>
                </div>

              {/* Contenido */}
              <div className="fb-notif-content">
                <div className="fb-notif-text">
                  <span className="fb-notif-channel-title">{notif.titulo}</span>
                  
                  {notif.tipo === 'miembro_removido' && (
                    <span className="fb-notif-status-tag red">[Removido]</span>
                  )}
                  {notif.tipo === 'canal_cerrado' && (
                    <span className="fb-notif-status-tag orange">[Cerrado]</span>
                  )}
                  {notif.unread_count > 0 && (
                    <span className="fb-notif-count-pill">
                      {notif.unread_count} {notif.unread_count === 1 ? 'nuevo' : 'nuevos'}
                    </span>
                  )}
                  <div className="fb-notif-body-preview">{notif.cuerpo}</div>
                </div>
                <div className="fb-notif-time">
                  {formatRelativeTime(notif.tiempo)}
                </div>
              </div>

              {/* Indicador azul de no leído y botón borrar */}
              <div className="fb-notif-right-actions" onClick={(e) => e.stopPropagation()}>
                {!notif.leida && <div className="fb-notif-blue-dot" />}
                <button
                  className="fb-notif-delete-btn"
                  title="Eliminar notificación"
                  onClick={() => onEliminarNotificacion(notif.id)}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          );
        })
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;
