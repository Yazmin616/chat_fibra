import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X, Phone, Video, UserPlus, Search, Pencil, Check, ChevronRight,
  ChevronDown, Star, Bell, Lock, Clock, Shield, Users, List,
  Heart, Bookmark, Download, MinusCircle, LogOut, ThumbsDown,
  Camera, Image as ImageIcon, FileText, UserCheck, ShieldAlert
} from 'lucide-react';
import { resolveAvatar, resolveMedia } from '../../services/api';
import { chatInternoService } from '../../services/chatInterno.service';
import ConfirmModal from './ConfirmModal';
import ChatInternoNotificationSettingsModal from './ChatInternoNotificationSettingsModal';
import ChatInternoMediaGallery from './ChatInternoMediaGallery';
import ChatInternoDestacadosPanel from './ChatInternoDestacadosPanel';
import { getPresenciaInfo } from '../../utils/presenceHelper';

const formatFechaCreacion = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const dia = d.getDate();
  const mes = d.getMonth() + 1;
  const anio = d.getFullYear();
  const hora = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${dia}/${mes}/${anio} a la(s) ${hora}`;
};

const ChatInternoDetailsPanel = ({
  canal,
  contactos = [],
  onClose,
  userActual,
  onEliminarCanal,
  onOcultarConversacion,
}) => {
  const [detalles, setDetalles] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Estados de edición inline
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombreEdit, setNombreEdit] = useState('');
  const [editandoDesc, setEditandoDesc] = useState(false);
  const [descEdit, setDescEdit] = useState('');

  // Búsqueda de miembros en el panel
  const [buscandoMiembros, setBuscandoMiembros] = useState(false);
  const [busquedaMiembro, setBusquedaMiembro] = useState('');

  // Añadir miembro
  const [mostrarAgregarMiembro, setMostrarAgregarMiembro] = useState(false);
  const [filtroNuevoMiembro, setFiltroNuevoMiembro] = useState('');

  // Menú contextual de opciones para un miembro
  const [menuMiembroId, setMenuMiembroId] = useState(null);

  // Modal Mensajes Temporales
  const [modalTemporalesOpen, setModalTemporalesOpen] = useState(false);
  const [mensajesTemporales, setMensajesTemporales] = useState(canal?.mensajes_temporales || 'desactivados');

  // Modal Ajustes de Notificaciones
  const [modalNotifOpen, setModalNotifOpen] = useState(false);

  // Subvista: 'info' (información general) | 'archivos' (visor clasificador de archivos, enlaces y documentos)
  const [vistaActual, setVistaActual] = useState('info');

  // Modal de confirmación
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    isDanger: true,
    onConfirm: null,
  });

  // Modal de foto a tamaño completo (solo visualizacion, como WhatsApp)
  const [fotoVisorUrl, setFotoVisorUrl] = useState(null);

  const fileInputRef = useRef(null);
  const canalId = canal?.id;

  useEffect(() => {
    if (canal) {
      setNombreEdit(canal.nombre || '');
      setDescEdit(canal.descripcion || '');
      setMensajesTemporales(canal.mensajes_temporales || 'desactivados');
      setVistaActual('info');
    }
  }, [canal?.id]);

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

  const miembros = detalles?.miembros || [];
  const archivos = detalles?.archivos || [];

  // Contactos disponibles para añadir
  const idsMiembrosActuales = useMemo(() => new Set(miembros.map(m => Number(m.id))), [miembros]);
  const contactosDisponibles = useMemo(() => contactos.filter(c => !idsMiembrosActuales.has(Number(c.id))), [contactos, idsMiembrosActuales]);
  const contactosFiltradosParaAgregar = useMemo(() => contactosDisponibles.filter(c =>
    (c.nombre || '').toLowerCase().includes(filtroNuevoMiembro.toLowerCase().trim()) ||
    (c.area || '').toLowerCase().includes(filtroNuevoMiembro.toLowerCase().trim())
  ), [contactosDisponibles, filtroNuevoMiembro]);

  // Miembros filtrados por buscador
  const miembrosFiltrados = useMemo(() => {
    if (!busquedaMiembro.trim()) return miembros;
    const term = busquedaMiembro.toLowerCase().trim();
    return miembros.filter(m =>
      (m.nombre || '').toLowerCase().includes(term) ||
      (m.area || '').toLowerCase().includes(term) ||
      (m.email || '').toLowerCase().includes(term)
    );
  }, [miembros, busquedaMiembro]);

  // Archivos de imagen recientes para la tira de miniaturas (priorizar fotos reales y stickers resueltos)
  const imagenesRecientes = useMemo(() => {
    // 1. Fotos y videos multimedia
    const fotos = archivos.filter(a => {
      const tipo = (a.tipo || '').toLowerCase();
      const url = a.url_adjunto || '';
      const name = (a.nombre_adjunto || '').toLowerCase();
      const isSticker = tipo === 'sticker' || url.startsWith('st://') || url.includes('/stickers/') || name === 'sticker.webp';
      if (isSticker) return false;
      return tipo === 'imagen' || (name && /\.(jpg|jpeg|png|webp|gif)$/i.test(name));
    });

    if (fotos.length > 0) {
      return fotos.slice(0, 4);
    }

    // 2. Si no hay fotos pero hay stickers, mostrar hasta 4 stickers
    return archivos
      .filter(a => a.url_adjunto && (a.tipo === 'sticker' || (a.nombre_adjunto && /\.(jpg|jpeg|png|webp|gif)$/i.test(a.nombre_adjunto))))
      .slice(0, 4);
  }, [archivos]);

  if (!canal) return null;

  // Renderizar la subvista de galería clasificada estilo WhatsApp
  if (vistaActual === 'archivos') {
    return (
      <ChatInternoMediaGallery
        canal={canal}
        archivos={archivos}
        onVolver={() => setVistaActual('info')}
        onClose={onClose}
        userActual={userActual}
      />
    );
  }

  // Renderizar la subvista de mensajes destacados estilo WhatsApp
  if (vistaActual === 'destacados') {
    return (
      <ChatInternoDestacadosPanel
        canal={canal}
        onVolver={() => setVistaActual('info')}
        onClose={onClose}
        userActual={userActual}
      />
    );
  }

  const esDirecto = canal.tipo === 'directo';
  const otro = canal.otro_participante;
  const esAdmin = userActual?.rol === 'admin';
  const esCreador = Number(canal.creador_id) === Number(userActual?.id);
  const miMiembro = miembros.find(m => Number(m.id) === Number(userActual?.id));
  const soyAdminCanal = miMiembro?.canal_rol === 'admin';
  const puedeGestionar = esAdmin || esCreador || soyAdminCanal;
  // Cualquier miembro activo puede cambiar la foto del grupo
  const soyMiembroActivo = !!miMiembro;

  // Manejo de cambio de Foto de grupo
  const handleFotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('foto', file);
      await chatInternoService.actualizarCanal(canal.id, formData);
    } catch (err) {
      console.error('Error al actualizar foto:', err);
    }
  };

  // Guardar nombre editado
  const handleGuardarNombre = async () => {
    if (!nombreEdit.trim() || nombreEdit.trim() === canal.nombre) {
      setEditandoNombre(false);
      return;
    }
    try {
      await chatInternoService.actualizarCanal(canal.id, { nombre: nombreEdit.trim() });
      setEditandoNombre(false);
    } catch (err) {
      console.error('Error al actualizar nombre:', err);
    }
  };

  // Guardar descripción editada
  const handleGuardarDescripcion = async () => {
    try {
      await chatInternoService.actualizarCanal(canal.id, { descripcion: descEdit.trim() });
      setEditandoDesc(false);
    } catch (err) {
      console.error('Error al actualizar descripción:', err);
    }
  };

  // Guardar mensajes temporales
  const handleGuardarTemporales = async (opcion) => {
    try {
      setMensajesTemporales(opcion);
      await chatInternoService.actualizarCanal(canal.id, { mensajesTemporales: opcion });
      setModalTemporalesOpen(false);
    } catch (err) {
      console.error('Error al guardar mensajes temporales:', err);
    }
  };

  // Añadir miembro
  const handleAgregarMiembro = async (agenteId) => {
    try {
      const data = await chatInternoService.agregarMiembro(canal.id, agenteId);
      setDetalles(data);
      setMostrarAgregarMiembro(false);
      setFiltroNuevoMiembro('');
    } catch (err) {
      console.error('Error al agregar miembro:', err);
    }
  };

  // Remover miembro
  const handleRemoverMiembro = (agenteId, agenteNombre) => {
    setMenuMiembroId(null);
    setConfirmDialog({
      isOpen: true,
      title: '¿Eliminar del grupo?',
      message: `¿Estás seguro de que deseas eliminar a ${agenteNombre} de este grupo?`,
      confirmText: 'Eliminar',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, isOpen: false }));
        try {
          const data = await chatInternoService.removerMiembro(canal.id, agenteId);
          setDetalles(data);
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  // Cambiar rol de miembro
  const handleCambiarRol = async (agenteId, nuevoRol) => {
    setMenuMiembroId(null);
    try {
      const data = await chatInternoService.cambiarRolMiembro(canal.id, agenteId, nuevoRol);
      setDetalles(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Salir del grupo
  const handleSalirCanal = () => {
    setConfirmDialog({
      isOpen: true,
      title: '¿Salir del grupo?',
      message: `¿Deseas salir del grupo "${canal.nombre}"? Ya no recibirás nuevos mensajes.`,
      confirmText: 'Salir del grupo',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, isOpen: false }));
        try {
          await chatInternoService.removerMiembro(canal.id, userActual.id);
          if (onClose) onClose();
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const getTextoTemporales = (val) => {
    switch (val) {
      case '24h': return '24 horas';
      case '7d': return '7 días';
      case '90d': return '90 días';
      default: return 'Desactivados';
    }
  };

  return (
    <>
      <aside className="ci-details-panel wa-info-panel">
        {/* ========================================================
            CABECERA ESTILO WHATSAPP: "✕ Info. del grupo"
        ======================================================== */}
        <div className="wa-info-header">
          <button
            type="button"
            className="wa-info-close-btn"
            onClick={onClose}
            title="Cerrar"
          >
            <X size={20} />
          </button>
          <span className="wa-info-header-title">
            {esDirecto ? 'Info. del contacto' : 'Info. del grupo'}
          </span>
        </div>

        <div className="wa-info-content-scroll">
          {/* ========================================================
              TARJETA SUPERIOR DE PERFIL (FOTO, NOMBRE, ACCIONES)
          ======================================================== */}
          <div className="wa-info-card wa-info-top-card">
            {/* Avatar circular grande */}
            <div className="wa-info-avatar-wrapper">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFotoChange}
                style={{ display: 'none' }}
              />
              <div
                className="wa-info-avatar-circle"
                onClick={() => {
                  if (esDirecto) {
                    // Chat directo: solo ver la foto en modal, no cambiar
                    const url = otro?.foto_perfil ? resolveAvatar(otro.foto_perfil) : null;
                    if (url) setFotoVisorUrl(url);
                  } else {
                    // Grupo/Canal: cualquier miembro puede cambiar la foto
                    if (soyMiembroActivo || esAdmin) {
                      fileInputRef.current?.click();
                    }
                  }
                }}
                style={{ cursor: esDirecto ? (otro?.foto_perfil ? 'zoom-in' : 'default') : (soyMiembroActivo || esAdmin ? 'pointer' : 'default') }}
                title={esDirecto ? (otro?.foto_perfil ? 'Ver foto de perfil' : '') : (soyMiembroActivo || esAdmin ? 'Cambiar foto del grupo' : '')}
              >
                {canal.foto ? (
                  <img
                    src={resolveAvatar(canal.foto)}
                    alt={canal.nombre}
                    className="wa-info-avatar-img"
                  />
                ) : esDirecto && otro?.foto_perfil ? (
                  <img
                    src={resolveAvatar(otro.foto_perfil)}
                    alt={otro.nombre}
                    className="wa-info-avatar-img"
                  />
                ) : (
                  <div className="wa-info-avatar-placeholder">
                    {esDirecto ? (
                      <span style={{ fontSize: '48px', color: '#8696a0' }}>
                        {otro?.nombre ? otro.nombre.charAt(0).toUpperCase() : 'U'}
                      </span>
                    ) : (
                      <Camera size={52} color="#8696a0" />
                    )}
                  </div>
                )}
                {!esDirecto && (soyMiembroActivo || esAdmin) && (
                  <div className="wa-info-avatar-hover-overlay">
                    <Camera size={26} color="#ffffff" />
                  </div>
                )}
              </div>
            </div>


            {/* Nombre del grupo / contacto */}
            <div className="wa-info-title-container">
              {editandoNombre ? (
                <div className="wa-info-edit-box">
                  <input
                    type="text"
                    value={nombreEdit}
                    onChange={(e) => setNombreEdit(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleGuardarNombre(); }}
                    className="wa-info-inline-input"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="wa-info-inline-save-btn"
                    onClick={handleGuardarNombre}
                  >
                    <Check size={18} />
                  </button>
                </div>
              ) : (
                <div className="wa-info-title-row">
                  <h2 className="wa-info-title-text" title={esDirecto ? otro?.nombre : canal.nombre}>
                    {esDirecto ? (otro?.nombre || 'Chat Directo') : canal.nombre}
                  </h2>
                  {puedeGestionar && !esDirecto && (
                    <button
                      type="button"
                      className="wa-info-pencil-btn"
                      onClick={() => setEditandoNombre(true)}
                      title="Editar nombre"
                    >
                      <Pencil size={18} />
                    </button>
                  )}
                </div>
              )}

              {/* Subtítulo: "Grupo • 8 miembros" */}
              <div className="wa-info-subtitle">
                {esDirecto ? (
                  <span>{otro?.email || otro?.area || 'Contacto interno'}</span>
                ) : (
                  <>
                    <span>Grupo • </span>
                    <span className="wa-info-members-highlight">
                      {miembros.length} {miembros.length === 1 ? 'miembro' : 'miembros'}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* 4 Botones de Acción Redondos (Llamar, Video, Añadir, Buscar) */}
            <div className="wa-info-quick-actions">
              <div className="wa-info-action-col">
                <button type="button" className="wa-info-action-circle-btn" title="Llamar">
                  <Phone size={20} />
                </button>
                <span className="wa-info-action-label">Llamar</span>
              </div>

              <div className="wa-info-action-col">
                <button type="button" className="wa-info-action-circle-btn" title="Video">
                  <Video size={20} />
                </button>
                <span className="wa-info-action-label">Video</span>
              </div>

              {!esDirecto && puedeGestionar && (
                <div className="wa-info-action-col">
                  <button
                    type="button"
                    className="wa-info-action-circle-btn"
                    title="Añadir miembro"
                    onClick={() => setMostrarAgregarMiembro(prev => !prev)}
                  >
                    <UserPlus size={20} />
                  </button>
                  <span className="wa-info-action-label">Añadir</span>
                </div>
              )}

              <div className="wa-info-action-col">
                <button
                  type="button"
                  className="wa-info-action-circle-btn"
                  title="Buscar en la conversación"
                >
                  <Search size={20} />
                </button>
                <span className="wa-info-action-label">Buscar</span>
              </div>
            </div>
          </div>

          {/* ========================================================
              DESCRIPCIÓN DEL GRUPO (ESTILO WHATSAPP)
          ======================================================== */}
          {!esDirecto && (
            <div className="wa-info-card wa-info-desc-card">
              {editandoDesc ? (
                <div className="wa-info-desc-edit-wrap">
                  <textarea
                    value={descEdit}
                    onChange={(e) => setDescEdit(e.target.value)}
                    className="wa-info-desc-textarea"
                    placeholder="Escribe la descripción del grupo..."
                    rows={3}
                    autoFocus
                  />
                  <div className="wa-info-desc-actions">
                    <button
                      type="button"
                      className="wa-info-btn-cancel"
                      onClick={() => setEditandoDesc(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="wa-info-btn-save"
                      onClick={handleGuardarDescripcion}
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="wa-info-desc-display-row">
                  <div className="wa-info-desc-text-wrap">
                    {canal.descripcion ? (
                      <span className="wa-info-desc-content">{canal.descripcion}</span>
                    ) : (
                      <span
                        className="wa-info-desc-placeholder"
                        onClick={() => puedeGestionar && setEditandoDesc(true)}
                        style={{ cursor: puedeGestionar ? 'pointer' : 'default' }}
                      >
                        Añadir descripción del grupo
                      </span>
                    )}
                  </div>
                  {puedeGestionar && (
                    <button
                      type="button"
                      className="wa-info-pencil-btn"
                      onClick={() => setEditandoDesc(true)}
                      title="Editar descripción"
                    >
                      <Pencil size={18} />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              ARCHIVOS, ENLACES Y DOCUMENTOS CON TIRA DE MINIATURAS
          ======================================================== */}
          <div
            className="wa-info-card wa-info-media-card"
            onClick={() => setVistaActual('archivos')}
            title="Ver y clasificar archivos, enlaces y documentos"
            style={{ cursor: 'pointer' }}
          >
            <div className="wa-info-media-header">
              <div className="wa-info-media-header-left">
                <ImageIcon size={20} className="wa-info-item-icon" />
                <span className="wa-info-item-title">Archivos, enlaces y documentos</span>
              </div>
              <div className="wa-info-media-count">
                <span>{archivos.length}</span>
                <ChevronRight size={18} />
              </div>
            </div>

            {/* Tira horizontal de miniaturas estilo WhatsApp */}
            {imagenesRecientes.length > 0 ? (
              <div className="wa-info-media-thumbs-grid">
                {imagenesRecientes.map(img => (
                  <div key={img.id} className="wa-info-media-thumb-item">
                    <img
                      src={resolveMedia(img.url_adjunto)}
                      alt={img.nombre_adjunto || 'Archivo'}
                      className="wa-info-thumb-img"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="wa-info-media-empty">No hay archivos compartidos aún</div>
            )}
          </div>

          {/* ========================================================
              CONFIGURACIONES Y PREFERENCIAS DEL CHAT
          ======================================================== */}
          <div className="wa-info-card wa-info-settings-card">
            {/* Mensajes destacados */}
            <div
              className="wa-info-row-item"
              onClick={() => setVistaActual('destacados')}
              style={{ cursor: 'pointer' }}
              title="Ver mensajes destacados en esta conversación"
            >
              <Star size={20} className="wa-info-item-icon" />
              <div className="wa-info-item-text">
                <div className="wa-info-item-title">Mensajes destacados</div>
              </div>
              <ChevronRight size={18} className="wa-info-chevron" />
            </div>

            {/* Ajustes de notificaciones */}
            <div
              className="wa-info-row-item"
              onClick={() => setModalNotifOpen(true)}
              style={{ cursor: 'pointer' }}
            >
              <Bell size={20} className="wa-info-item-icon" />
              <div className="wa-info-item-text">
                <div className="wa-info-item-title">Ajustes de notificaciones</div>
              </div>
              <ChevronRight size={18} className="wa-info-chevron" />
            </div>

            {/* Cifrado */}
            <div className="wa-info-row-item no-chevron">
              <Lock size={20} className="wa-info-item-icon" />
              <div className="wa-info-item-text">
                <div className="wa-info-item-title">Cifrado</div>
                <div className="wa-info-item-desc">
                  Los mensajes están sincronizados y protegidos en el entorno interno corporativo.
                </div>
              </div>
            </div>

            {/* Mensajes temporales */}
            <div
              className="wa-info-row-item"
              onClick={() => puedeGestionar && setModalTemporalesOpen(true)}
              style={{ cursor: puedeGestionar ? 'pointer' : 'default' }}
            >
              <Clock size={20} className="wa-info-item-icon" />
              <div className="wa-info-item-text">
                <div className="wa-info-item-title">Mensajes temporales</div>
                <div className="wa-info-item-desc">
                  {getTextoTemporales(mensajesTemporales)}
                </div>
              </div>
              {puedeGestionar && <ChevronRight size={18} className="wa-info-chevron" />}
            </div>

            {/* Privacidad avanzada */}
            <div className="wa-info-row-item no-chevron">
              <Shield size={20} className="wa-info-item-icon" />
              <div className="wa-info-item-text">
                <div className="wa-info-item-title">Privacidad avanzada del chat</div>
                <div className="wa-info-item-desc">Desactivado</div>
              </div>
            </div>

            {/* Crea un grupo similar */}
            {!esDirecto && (
              <div className="wa-info-row-item no-chevron">
                <Users size={20} className="wa-info-item-icon" />
                <div className="wa-info-item-text">
                  <div className="wa-info-item-title">Crea un grupo similar</div>
                  <div className="wa-info-item-desc">
                    Empieza con los mismos miembros. Puedes añadir o quitar personas.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================
              SECCIÓN DE MIEMBROS ESTILO WHATSAPP DESKTOP
          ======================================================== */}
          {!esDirecto && (
            <div className="wa-info-card wa-info-members-card">
              {/* Cabecera de Miembros: "8 miembros" + buscador */}
              <div className="wa-info-members-header">
                <span className="wa-info-members-count-title">
                  {miembros.length} {miembros.length === 1 ? 'miembro' : 'miembros'}
                </span>
                <button
                  type="button"
                  className="wa-info-icon-btn"
                  onClick={() => setBuscandoMiembros(prev => !prev)}
                  title="Buscar miembros"
                >
                  <Search size={18} />
                </button>
              </div>

              {/* Input buscador si está activo */}
              {buscandoMiembros && (
                <div className="wa-info-member-search-input-wrap">
                  <Search size={16} className="wa-info-search-icon" />
                  <input
                    type="text"
                    placeholder="Buscar miembros..."
                    value={busquedaMiembro}
                    onChange={(e) => setBusquedaMiembro(e.target.value)}
                    autoFocus
                  />
                  {busquedaMiembro && (
                    <button
                      type="button"
                      className="wa-info-clear-search-btn"
                      onClick={() => setBusquedaMiembro('')}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* Opción "+ Añadir miembro" */}
              {puedeGestionar && (
                <div
                  className="wa-info-add-member-row"
                  onClick={() => setMostrarAgregarMiembro(prev => !prev)}
                >
                  <div className="wa-info-add-member-green-circle">
                    <UserPlus size={20} color="#111b21" />
                  </div>
                  <span className="wa-info-add-member-text">Añadir miembro</span>
                </div>
              )}

              {/* Desplegable de contactos para añadir */}
              {mostrarAgregarMiembro && (
                <div className="wa-info-add-member-popover">
                  <div className="wa-info-popover-header">
                    <input
                      type="text"
                      placeholder="Escribe el nombre del contacto..."
                      value={filtroNuevoMiembro}
                      onChange={(e) => setFiltroNuevoMiembro(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="wa-info-popover-list">
                    {contactosFiltradosParaAgregar.length === 0 ? (
                      <div className="wa-info-popover-empty">No hay contactos disponibles</div>
                    ) : (
                      contactosFiltradosParaAgregar.map(c => (
                        <div
                          key={c.id}
                          className="wa-info-popover-item"
                          onClick={() => handleAgregarMiembro(c.id)}
                        >
                          <div className="wa-info-popover-avatar-wrap">
                            {c.foto_perfil ? (
                              <img src={resolveAvatar(c.foto_perfil)} alt={c.nombre} />
                            ) : (
                              <div className="wa-info-popover-avatar-placeholder">
                                {c.nombre ? c.nombre.charAt(0).toUpperCase() : 'U'}
                              </div>
                            )}
                          </div>
                          <div className="wa-info-popover-name-wrap">
                            <div className="wa-info-popover-name">{c.nombre}</div>
                            <div className="wa-info-popover-sub">{c.area || c.rol}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Lista de Miembros */}
              <div className="wa-info-members-list">
                {miembrosFiltrados.map(m => {
                  const esYo = Number(m.id) === Number(userActual?.id);
                  const esAdminMiembro = m.canal_rol === 'admin';
                  const isMenuOpen = menuMiembroId === m.id;

                  return (
                    <div
                      key={m.id}
                      className="wa-info-member-item"
                      onMouseLeave={() => isMenuOpen && setMenuMiembroId(null)}
                    >
                      {/* Avatar del miembro */}
                      <div className="wa-info-member-avatar-wrap">
                        {m.foto_perfil ? (
                          <img
                            src={resolveAvatar(m.foto_perfil)}
                            alt={m.nombre}
                            className="wa-info-member-avatar-img"
                            style={{ cursor: 'zoom-in' }}
                            onClick={() => setFotoVisorUrl(resolveAvatar(m.foto_perfil))}
                            title="Ver foto de perfil"
                          />
                        ) : (
                          <div className="wa-info-member-avatar-placeholder">
                            {m.nombre ? m.nombre.charAt(0).toUpperCase() : 'U'}
                          </div>
                        )}
                        {(() => {
                          const pres = getPresenciaInfo(m);
                          return (
                            <div
                              className="wa-info-online-badge"
                              style={{
                                backgroundColor: pres.color,
                                border: '2px solid #ffffff',
                                boxShadow: `0 0 0 1px ${pres.border}45, 0 1px 3px rgba(0,0,0,0.25)`
                              }}
                              title={`${m.nombre}: ${pres.labelConEstado}${pres.desc ? ` (${pres.desc})` : ''}`}
                            />
                          );
                        })()}
                      </div>

                      {/* Información del miembro */}
                      <div className="wa-info-member-info">
                        <div className="wa-info-member-top-row">
                          <span className="wa-info-member-name">
                            {esYo ? 'Tú' : m.nombre}
                          </span>
                          {esAdminMiembro && (
                            <span className="wa-info-admin-badge">Admin. del grupo</span>
                          )}
                        </div>

                        <div className="wa-info-member-bottom-row">
                          {esYo ? (
                            <span className="wa-info-member-tag-green">
                              {m.area || 'Colaborador interno'}
                            </span>
                          ) : (() => {
                            const pres = getPresenciaInfo(m);
                            return (
                              <span className="wa-info-member-status" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '0 5px',
                                    borderRadius: '8px',
                                    background: `${pres.color}18`,
                                    border: `1px solid ${pres.color}40`,
                                    color: pres.color,
                                    fontSize: '0.67rem',
                                    fontWeight: 600,
                                    lineHeight: '14px'
                                  }}
                                >
                                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: pres.color }} />
                                  {pres.labelConEstado}
                                </span>
                                {m.area && <span style={{ color: '#8696a0', fontSize: '0.75rem' }}>• {m.area}</span>}
                                {m.mensaje_presencia && <span style={{ fontStyle: 'italic', color: '#8696a0', fontSize: '0.74rem' }}>"{m.mensaje_presencia}"</span>}
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Menú de opciones (chevron down) */}
                      {puedeGestionar && !esYo && (
                        <div className="wa-info-member-actions-wrap">
                          <button
                            type="button"
                            className="wa-info-chevron-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuMiembroId(isMenuOpen ? null : m.id);
                            }}
                            title="Opciones de miembro"
                          >
                            <ChevronDown size={18} />
                          </button>

                          {isMenuOpen && (
                            <div className="wa-info-member-dropdown-menu">
                              <button
                                type="button"
                                onClick={() => handleCambiarRol(m.id, esAdminMiembro ? 'miembro' : 'admin')}
                              >
                                {esAdminMiembro ? 'Descartar como admin. del grupo' : 'Hacer admin. del grupo'}
                              </button>
                              <button
                                type="button"
                                className="danger"
                                onClick={() => handleRemoverMiembro(m.id, m.nombre)}
                              >
                                Eliminar a {m.nombre.split(' ')[0]}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================
              ACCIONES DE UTILIDAD Y SALIR DEL GRUPO (ESTILO WHATSAPP)
          ======================================================== */}
          {!esDirecto && (
            <div className="wa-info-card wa-info-danger-card">
              <div className="wa-info-row-item">
                <List size={20} className="wa-info-item-icon" />
                <div className="wa-info-item-text">
                  <div className="wa-info-item-title">Ver cambios en los miembros</div>
                </div>
              </div>

              <div className="wa-info-row-item">
                <Heart size={20} className="wa-info-item-icon" />
                <div className="wa-info-item-text">
                  <div className="wa-info-item-title">Añadir a Favoritos</div>
                </div>
              </div>

              <div className="wa-info-row-item">
                <Bookmark size={20} className="wa-info-item-icon" />
                <div className="wa-info-item-text">
                  <div className="wa-info-item-title">Añadir a la lista</div>
                </div>
              </div>

              <div className="wa-info-row-item">
                <Download size={20} className="wa-info-item-icon" />
                <div className="wa-info-item-text">
                  <div className="wa-info-item-title">Exportar chat</div>
                </div>
              </div>

              {/* Acciones en color rojo */}
              <div
                className="wa-info-row-item danger"
                onClick={() => onOcultarConversacion && onOcultarConversacion(canal.id)}
              >
                <MinusCircle size={20} className="wa-info-item-icon danger" />
                <div className="wa-info-item-text">
                  <div className="wa-info-item-title danger">Vaciar chat</div>
                </div>
              </div>

              <div
                className="wa-info-row-item danger"
                onClick={handleSalirCanal}
              >
                <LogOut size={20} className="wa-info-item-icon danger" />
                <div className="wa-info-item-text">
                  <div className="wa-info-item-title danger">Salir del grupo</div>
                </div>
              </div>

              <div className="wa-info-row-item danger">
                <ThumbsDown size={20} className="wa-info-item-icon danger" />
                <div className="wa-info-item-text">
                  <div className="wa-info-item-title danger">Reportar grupo</div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              PIE DE PÁGINA: "Grupo creado por..."
          ======================================================== */}
          {!esDirecto && (
            <div className="wa-info-footer-note">
              Grupo creado por {canal.creador_nombre || 'un administrador'} el {formatFechaCreacion(canal.created_at)}
            </div>
          )}
        </div>
      </aside>

      {/* ========================================================
          MODAL: MENSAJES TEMPORALES (ESTILO WHATSAPP)
      ======================================================== */}
      {modalTemporalesOpen && (
        <div
          className="wa-temporales-modal-overlay"
          onClick={() => setModalTemporalesOpen(false)}
        >
          <div
            className="wa-temporales-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wa-temporales-modal-title">Mensajes temporales</div>
            <div className="wa-temporales-modal-desc">
              Para más privacidad y espacio de almacenamiento, los mensajes nuevos desaparecerán de este chat para todos después del tiempo seleccionado, a menos que se conserven.
            </div>

            <div className="wa-temporales-radio-list">
              {[
                { id: '24h', label: '24 horas' },
                { id: '7d', label: '7 días' },
                { id: '90d', label: '90 días' },
                { id: 'desactivados', label: 'Desactivados' },
              ].map(opt => (
                <label key={opt.id} className="wa-temporales-radio-item">
                  <span>{opt.label}</span>
                  <input
                    type="radio"
                    name="mensajes_temporales_details"
                    value={opt.id}
                    checked={mensajesTemporales === opt.id}
                    onChange={() => handleGuardarTemporales(opt.id)}
                  />
                  <span className="wa-temporales-radio-custom" />
                </label>
              ))}
            </div>

            <div className="wa-temporales-modal-actions">
              <button
                type="button"
                className="wa-temporales-btn-ok"
                onClick={() => setModalTemporalesOpen(false)}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajustes de Notificaciones */}
      {modalNotifOpen && (
        <ChatInternoNotificationSettingsModal
          userId={userActual?.id}
          canal={canal}
          onClose={() => setModalNotifOpen(false)}
        />
      )}

      {/* ========================================================
          MODAL DE CONFIRMACIÓN GENERAL
      ======================================================== */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        isDanger={confirmDialog.isDanger}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(d => ({ ...d, isOpen: false }))}
      />

      {/* Modal de visualizacion de foto de perfil (solo lectura, como WhatsApp) */}
      {fotoVisorUrl && (
        <div
          className="wa-foto-visor-overlay"
          onClick={() => setFotoVisorUrl(null)}
        >
          <div className="wa-foto-visor-content" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="wa-foto-visor-close"
              onClick={() => setFotoVisorUrl(null)}
              title="Cerrar"
            >
              <X size={22} />
            </button>
            <img src={fotoVisorUrl} alt="Foto de perfil" className="wa-foto-visor-img" />
          </div>
        </div>
      )}
    </>
  );
};

export default ChatInternoDetailsPanel;
