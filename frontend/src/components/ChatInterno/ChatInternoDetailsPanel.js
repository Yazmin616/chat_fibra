import React, { useState, useEffect } from 'react';
import {
  X, Hash, Lock, Users, FileText, Download, UserPlus, Trash2,
  Mail, Briefcase, Shield, Image, File
} from 'lucide-react';
import { API_URL, resolveAvatar } from '../../services/api';
import { chatInternoService } from '../../services/chatInterno.service';
import ConfirmModal from './ConfirmModal';

const ChatInternoDetailsPanel = ({
  canal,
  contactos,
  onClose,
  userActual,
  onEliminarCanal,
  onOcultarConversacion,
}) => {
  const [detalles, setDetalles] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState('miembros'); // 'miembros' | 'archivos'
  const [agregandoMiembro, setAgregandoMiembro] = useState(false);
  const [nuevoMiembroId, setNuevoMiembroId] = useState('');

  // Estado para el modal de confirmación visual
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    isDanger: true,
    onConfirm: null,
  });

  const canalId = canal?.id;

  useEffect(() => {
    if (!canalId) return;
    let cancel = false;

    const cargar = async () => {
      try {
        const data = await chatInternoService.getDetallesCanal(canalId);
        if (!cancel) {
          setDetalles(data);
        }
      } catch (err) {
        console.error('Error al cargar detalles del canal:', err);
      } finally {
        if (!cancel) setCargando(false);
      }
    };

    cargar();
    return () => { cancel = true; };
  }, [canalId]);

  if (!canal) return null;

  const esDirecto = canal.tipo === 'directo';
  const otro = canal.otro_participante;
  const esAdmin = userActual?.rol === 'admin';
  const esCreador = Number(canal.creador_id) === Number(userActual?.id);
  const puedeGestionar = esAdmin || esCreador;

  // Filtrar contactos que aún no están en el canal
  const idsMiembrosActuales = new Set((detalles?.miembros || []).map(m => Number(m.id)));
  const contactosDisponibles = contactos.filter(c => !idsMiembrosActuales.has(Number(c.id)));

  const handleAgregarMiembro = async () => {
    if (!nuevoMiembroId) return;
    try {
      const data = await chatInternoService.agregarMiembro(canal.id, nuevoMiembroId);
      setDetalles(data);
      setNuevoMiembroId('');
      setAgregandoMiembro(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoverMiembroClick = (agenteId, agenteNombre) => {
    setConfirmDialog({
      isOpen: true,
      title: '¿Remover miembro?',
      message: `¿Deseas remover a ${agenteNombre} de #${canal.nombre}? Dejará de recibir mensajes pero conservará el historial previo.`,
      confirmText: 'Remover',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, isOpen: false }));
        try {
          await chatInternoService.removerMiembro(canal.id, agenteId);
          setDetalles(prev => ({
            ...prev,
            miembros: prev.miembros.filter(m => Number(m.id) !== Number(agenteId)),
          }));
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const handleEliminarCanalClick = () => {
    setConfirmDialog({
      isOpen: true,
      title: '¿Cerrar y eliminar canal?',
      message: `¿Cerrar y eliminar el canal #${canal.nombre} para todo el equipo? Se desactivarán todos los miembros y quedará archivado en solo lectura para consulta.`,
      confirmText: 'Cerrar Canal',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, isOpen: false }));
        try {
          await onEliminarCanal(canal.id);
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const handleOcultarConversacionClick = () => {
    setConfirmDialog({
      isOpen: true,
      title: '¿Eliminar conversación?',
      message: 'Esta conversación se quitará de tu panel lateral. Los demás integrantes no se verán afectados.',
      confirmText: 'Eliminar',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, isOpen: false }));
        try {
          await onOcultarConversacion(canal.id);
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  return (
    <>
      <aside className="ci-details-panel">
        {/* Cabecera del Panel */}
        <div className="ci-details-header">
          <span className="ci-details-header-title">
            {esDirecto ? 'Perfil del Colaborador' : 'Detalles del Canal'}
          </span>
          <button className="ci-btn-icon" onClick={onClose} title="Cerrar panel">
            <X size={18} />
          </button>
        </div>

        <div className="ci-details-content">
          {esDirecto ? (
            /* ================= Ficha de Chat Directo ================= */
            <div className="ci-profile-card">
              <div className="ci-profile-avatar-wrap">
                {otro?.foto_perfil ? (
                  <img
                    src={resolveAvatar(otro.foto_perfil)}
                    alt={otro.nombre}
                    className="ci-profile-avatar"
                  />
                ) : (
                  <div className="ci-profile-avatar-placeholder">
                    {otro?.nombre ? otro.nombre.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <div className={`ci-online-dot ${otro?.esta_online ? (otro?.estado_presencia || 'disponible') : 'offline'}`} />
              </div>

              <h3 className="ci-profile-name">{otro?.nombre || 'Compañero'}</h3>
              <div className="ci-profile-status-pill">
                <span 
                  className={`ci-status-indicator ${otro?.esta_online ? (otro?.estado_presencia || 'online') : 'offline'}`}
                  style={{
                    backgroundColor: !otro?.esta_online ? '#94a3b8' : (
                      otro?.estado_presencia === 'reunion' ? '#f59e0b' :
                      otro?.estado_presencia === 'ocupado' ? '#ef4444' :
                      otro?.estado_presencia === 'comida'  ? '#d97706' :
                      otro?.estado_presencia === 'ausente' ? '#64748b' : '#10b981'
                    )
                  }}
                />
                <span>
                  {!otro?.esta_online ? 'Desconectado' : (
                    otro?.estado_presencia === 'reunion' ? 'En reunión' :
                    otro?.estado_presencia === 'ocupado' ? 'No molestar' :
                    otro?.estado_presencia === 'comida'  ? 'En comida' :
                    otro?.estado_presencia === 'ausente' ? 'Ausente' : 'Conectado ahora'
                  )}
                </span>
              </div>

              <div className="ci-profile-info-list">
                <div className="ci-profile-info-item">
                  <Briefcase size={16} color="#64748b" />
                  <div>
                    <div className="ci-info-label">Área / Cargo</div>
                    <div className="ci-info-val">{otro?.area || 'Sin área'} • {otro?.rol}</div>
                  </div>
                </div>

                {otro?.email && (
                  <div className="ci-profile-info-item">
                    <Mail size={16} color="#64748b" />
                    <div>
                      <div className="ci-info-label">Correo Corporativo</div>
                      <div className="ci-info-val">{otro.email}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ================= Ficha de Canal Grupal ================= */
            <div className="ci-channel-info-card">
              <div className="ci-channel-badge-header">
                <div className="ci-channel-icon-wrap" style={{ background: canal.es_privado ? '#475569' : '#2563eb' }}>
                  {canal.es_privado ? <Lock size={20} /> : <Hash size={22} />}
                </div>
                <div>
                  <h3 className="ci-channel-name">#{canal.nombre}</h3>
                  <span className="ci-channel-type">
                    {canal.es_privado ? 'Canal Privado' : 'Canal Público'}
                    {canal.solo_lectura && ' • Solo Lectura'}
                  </span>
                </div>
              </div>

              {canal.solo_lectura && (
                <div className="ci-solo-lectura-alert">
                  <Shield size={16} color="#2563eb" />
                  <span>Solo los administradores y el creador pueden publicar mensajes. Los miembros pueden leer y reaccionar.</span>
                </div>
              )}

              {canal.descripcion && (
                <div className="ci-channel-desc">
                  <strong>Descripción:</strong>
                  <p>{canal.descripcion}</p>
                </div>
              )}

              {/* Pestañas Miembros / Archivos */}
              <div className="ci-tabs-nav">
                <button
                  className={`ci-tab-btn ${tab === 'miembros' ? 'active' : ''}`}
                  onClick={() => setTab('miembros')}
                >
                  <Users size={15} />
                  <span>Miembros ({detalles?.miembros?.length || 0})</span>
                </button>
                <button
                  className={`ci-tab-btn ${tab === 'archivos' ? 'active' : ''}`}
                  onClick={() => setTab('archivos')}
                >
                  <FileText size={15} />
                  <span>Archivos ({detalles?.archivos?.length || 0})</span>
                </button>
              </div>
            </div>
          )}

          {/* ================= Lista de Miembros (Canal Grupal) ================= */}
          {!esDirecto && tab === 'miembros' && (
            <div className="ci-members-section">
              {puedeGestionar && (
                <div className="ci-add-member-wrap">
                  {!agregandoMiembro ? (
                    <button
                      className="ci-btn-add-member"
                      onClick={() => setAgregandoMiembro(true)}
                    >
                      <UserPlus size={15} />
                      <span>Añadir Miembro</span>
                    </button>
                  ) : (
                    <div className="ci-add-member-form">
                      <select
                        value={nuevoMiembroId}
                        onChange={(e) => setNuevoMiembroId(e.target.value)}
                      >
                        <option value="">Seleccionar colaborador...</option>
                        {contactosDisponibles.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.nombre} ({c.area || c.rol})
                          </option>
                        ))}
                      </select>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="ci-btn-small-primary"
                          onClick={handleAgregarMiembro}
                          disabled={!nuevoMiembroId}
                        >
                          Añadir
                        </button>
                        <button
                          className="ci-btn-small-secondary"
                          onClick={() => setAgregandoMiembro(false)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="ci-members-list">
                {cargando ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                    Cargando miembros...
                  </div>
                ) : (
                  (detalles?.miembros || []).map((m) => (
                    <div key={m.id} className="ci-member-item">
                      <div className="ci-member-avatar-wrap">
                        {m.foto_perfil ? (
                          <img src={resolveAvatar(m.foto_perfil)} alt={m.nombre} />
                        ) : (
                          <div className="ci-member-placeholder">
                            {m.nombre.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className={`ci-online-dot ${m.esta_online ? (m.estado_presencia || 'disponible') : 'offline'}`} />
                      </div>

                      <div className="ci-member-info">
                        <div className="ci-member-name">
                          <span>{m.nombre}</span>
                          {Number(m.id) === Number(userActual?.id) && <span style={{ opacity: 0.6 }}>(Tú)</span>}
                        </div>
                        <div className="ci-member-sub">
                          {m.area || m.rol} {m.canal_rol === 'admin' ? '• Admin del canal' : ''}
                        </div>
                      </div>

                      {puedeGestionar && Number(m.id) !== Number(userActual?.id) && (
                        <button
                          className="ci-btn-remove-member"
                          title="Remover del canal"
                          onClick={() => handleRemoverMiembroClick(m.id, m.nombre)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ================= Archivos Compartidos ================= */}
          {(esDirecto || tab === 'archivos') && (
            <div className="ci-files-section">
              <div className="ci-section-subtitle">
                <span>Archivos y Documentos</span>
              </div>

              {cargando ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                  Cargando archivos...
                </div>
              ) : (!detalles?.archivos || detalles.archivos.length === 0) ? (
                <div className="ci-empty-files">
                  <FileText size={32} strokeWidth={1.5} color="#94a3b8" />
                  <p>No se han compartido archivos en esta conversación.</p>
                </div>
              ) : (
                <div className="ci-files-list">
                  {detalles.archivos.map((file) => (
                    <a
                      key={file.id}
                      href={`${API_URL}${file.url_adjunto}`}
                      target="_blank"
                      rel="noreferrer"
                      className="ci-file-item"
                      download
                    >
                      <div className="ci-file-icon-wrap">
                        {file.tipo === 'imagen' ? <Image size={18} color="#2563eb" /> : <File size={18} color="#e11d48" />}
                      </div>
                      <div className="ci-file-info">
                        <div className="ci-file-name">{file.nombre_adjunto || 'Archivo'}</div>
                        <div className="ci-file-meta">
                          {file.tamano_adjunto ? `${(file.tamano_adjunto / 1024).toFixed(1)} KB` : ''} • {new Date(file.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Download size={15} className="ci-file-download-icon" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= Acciones de Gestión y Salida ================= */}
          <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border-color, #e2e8f0)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Botón para Administrador / Creador: Cerrar y eliminar canal a nivel global */}
            {!esDirecto && puedeGestionar && !canal.canal_eliminado && (
              <button
                onClick={handleEliminarCanalClick}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  background: '#fff1f2',
                  color: '#e11d48',
                  border: '1px solid #fecdd3',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={15} />
                <span>Cerrar y Eliminar Canal</span>
              </button>
            )}

            {/* Botón individual: Eliminar conversación */}
            {(canal.canal_eliminado || canal.soy_miembro_activo === false || esDirecto) && (
              <button
                onClick={handleOcultarConversacionClick}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={15} />
                <span>Eliminar conversación</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Modal de Confirmación Visual Integrado */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        isDanger={confirmDialog.isDanger}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(d => ({ ...d, isOpen: false }))}
      />
    </>
  );
};

export default ChatInternoDetailsPanel;
