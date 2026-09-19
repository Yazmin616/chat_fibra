import React, { useState, useRef, useMemo } from 'react';
import {
  ArrowLeft, ArrowRight, Check, Camera, ChevronRight, X,
  Smile, Clock, ShieldCheck
} from 'lucide-react';
import { resolveAvatar } from '../../services/api';
import { getPresenciaInfo } from '../../utils/presenceHelper';

const EMOJIS_POPULARES = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
  '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖',
  '👍', '👎', '👏', '🙌', '🤝', '🔥', '✨', '🎉', '🚀', '❤️',
  '💼', '📊', '📈', '📌', '📎', '💻', '💡', '🔔', '📣', '✅'
];

const CrearGrupoWhatsAppDrawer = ({
  contactos = [],
  userActual,
  onCrear,
  onClose,
}) => {
  // Paso: 1 = Miembros, 2 = Info grupo (foto, asunto, etc), 3 = Permisos
  const [paso, setPaso] = useState(1);

  // Paso 1: Selección de miembros
  const [busqueda, setBusqueda] = useState('');
  const [miembrosSeleccionados, setMiembrosSeleccionados] = useState([]);

  // Paso 2: Datos del grupo
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [mensajesTemporales, setMensajesTemporales] = useState('desactivados');
  const [modalTemporalesOpen, setModalTemporalesOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Paso 3: Permisos
  const [permisos, setPermisos] = useState({
    editar_ajustes: true,
    enviar_mensajes: true,
    agregar_miembros: true,
    enlace_invitacion: true,
    aprobar_miembros: false,
  });

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);
  const subjectInputRef = useRef(null);

  // Contactos disponibles (excluyendo al usuario actual)
  const contactosDisponibles = useMemo(() => {
    return contactos.filter(c => Number(c.id) !== Number(userActual?.id));
  }, [contactos, userActual]);

  // Filtrado por búsqueda en paso 1
  const contactosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return contactosDisponibles;
    const term = busqueda.toLowerCase().trim();
    return contactosDisponibles.filter(c =>
      (c.nombre || '').toLowerCase().includes(term) ||
      (c.area || '').toLowerCase().includes(term) ||
      (c.email || '').toLowerCase().includes(term)
    );
  }, [contactosDisponibles, busqueda]);

  // Lista de miembros seleccionados con sus objetos completos
  const miembrosObjList = useMemo(() => {
    return miembrosSeleccionados
      .map(id => contactos.find(c => Number(c.id) === Number(id)))
      .filter(Boolean);
  }, [miembrosSeleccionados, contactos]);

  const toggleMiembro = (id) => {
    const numId = Number(id);
    setMiembrosSeleccionados(prev =>
      prev.includes(numId) ? prev.filter(mId => mId !== numId) : [...prev, numId]
    );
  };

  const handleFotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFotoFile(file);
      const url = URL.createObjectURL(file);
      setFotoPreview(url);
    }
  };

  const handleTogglePermiso = (key) => {
    setPermisos(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSubmit = async () => {
    if (guardando || !nombre.trim()) {
      if (!nombre.trim()) setError('Escribe un asunto para el grupo');
      return;
    }

    try {
      setGuardando(true);
      setError('');

      const formData = new FormData();
      formData.append('nombre', nombre.trim());
      formData.append('descripcion', descripcion.trim());
      formData.append('esPrivado', 'true');
      formData.append('soloLectura', !permisos.enviar_mensajes ? 'true' : 'false');
      formData.append('miembroIds', JSON.stringify(miembrosSeleccionados));
      formData.append('mensajesTemporales', mensajesTemporales);
      formData.append('permisos', JSON.stringify(permisos));

      if (fotoFile) {
        formData.append('foto', fotoFile);
      }

      await onCrear(formData);
      onClose();
    } catch (err) {
      console.error('Error al crear grupo:', err);
      setError(err.message || 'No se pudo crear el grupo');
    } finally {
      setGuardando(false);
    }
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
    <div className="wa-drawer-container">
      {
      /* ========================================================
          CABECERA DEL DRAWER
      ======================================================== */}
      <header className="wa-drawer-header">
        <button
          type="button"
          className="wa-drawer-back-btn"
          onClick={() => {
            if (paso === 3) setPaso(2);
            else if (paso === 2) setPaso(1);
            else onClose();
          }}
          title="Atrás"
        >
          <ArrowLeft size={22} />
        </button>
        <h2 className="wa-drawer-title">
          {paso === 1 && 'Añade miembros al grupo'}
          {paso === 2 && 'Nuevo grupo'}
          {paso === 3 && 'Permisos del grupo'}
        </h2>
      </header>

      {/* ========================================================
          PASO 1: SELECCIÓN DE MIEMBROS
      ======================================================== */}
      {paso === 1 && (
        <div className="wa-drawer-body wa-step1-body">
          {/* Zona de Búsqueda y Chips seleccionados */}
          <div className="wa-members-input-section">
            <div className="wa-chips-flow-container">
              {miembrosObjList.map(m => (
                <div key={m.id} className="wa-member-chip">
                  {m.foto_perfil ? (
                    <img
                      src={resolveAvatar(m.foto_perfil)}
                      alt={m.nombre}
                      className="wa-chip-avatar"
                    />
                  ) : (
                    <div className="wa-chip-avatar-placeholder">
                      {m.nombre ? m.nombre.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                  <span className="wa-chip-name">{m.nombre}</span>
                  <button
                    type="button"
                    className="wa-chip-remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMiembro(m.id);
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}

              <input
                type="text"
                className="wa-chip-search-input"
                placeholder={miembrosSeleccionados.length === 0 ? "Escribe el nombre del contacto" : ""}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Lista de Contactos */}
          <div className="wa-members-list-scroll">
            <div className="wa-section-divider-label">
              {busqueda.trim() ? 'RESULTADOS' : 'FRECUENTES'}
            </div>

            {contactosFiltrados.length === 0 ? (
              <div className="wa-empty-members-hint">
                No se encontraron contactos que coincidan.
              </div>
            ) : (
              contactosFiltrados.map(contacto => {
                const isSelected = miembrosSeleccionados.includes(Number(contacto.id));
                return (
                  <div
                    key={contacto.id}
                    className={`wa-member-select-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleMiembro(contacto.id)}
                  >
                    <div className="wa-member-item-avatar-wrap">
                      {contacto.foto_perfil ? (
                        <img
                          src={resolveAvatar(contacto.foto_perfil)}
                          alt={contacto.nombre}
                          className="wa-member-item-avatar"
                        />
                      ) : (
                        <div className="wa-member-item-avatar-placeholder">
                          {contacto.nombre ? contacto.nombre.charAt(0).toUpperCase() : 'U'}
                        </div>
                      )}
                      {(() => {
                        const pres = getPresenciaInfo(contacto);
                        return (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: '-2px',
                              right: '-2px',
                              width: '11px',
                              height: '11px',
                              borderRadius: '50%',
                              backgroundColor: pres.color,
                              border: '2px solid #ffffff',
                              boxShadow: `0 0 0 1px ${pres.border}45, 0 1px 2px rgba(0,0,0,0.3)`
                            }}
                            title={pres.labelConEstado}
                          />
                        );
                      })()}
                    </div>

                    <div className="wa-member-item-info">
                      <div className="wa-member-item-name">{contacto.nombre}</div>
                      <div className="wa-member-item-status" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {(() => {
                          const pres = getPresenciaInfo(contacto);
                          return (
                            <>
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
                              {contacto.area && <span style={{ color: '#8696a0', fontSize: '0.74rem' }}>• {contacto.area}</span>}
                              {contacto.mensaje_presencia && <span style={{ fontStyle: 'italic', color: '#8696a0', fontSize: '0.73rem' }}>"{contacto.mensaje_presencia}"</span>}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Botón flotante verde siguiente */}
          {miembrosSeleccionados.length > 0 && (
            <div className="wa-floating-btn-wrap">
              <button
                type="button"
                className="wa-floating-action-btn"
                onClick={() => setPaso(2)}
                title="Siguiente"
              >
                <ArrowRight size={24} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          PASO 2: ASUNTO, FOTO, MENSAJES TEMPORALES Y AJUSTES
      ======================================================== */}
      {paso === 2 && (
        <div className="wa-drawer-body wa-step2-body">
          {/* Uploader de Foto Circular estilo WhatsApp */}
          <div className="wa-group-avatar-uploader-wrap">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFotoChange}
              accept="image/*"
              style={{ display: 'none' }}
            />
            <div
              className="wa-group-avatar-uploader-circle"
              onClick={() => fileInputRef.current?.click()}
              title="Añadir foto del grupo"
            >
              {fotoPreview ? (
                <img
                  src={fotoPreview}
                  alt="Foto del grupo"
                  className="wa-group-avatar-preview-img"
                />
              ) : (
                <div className="wa-group-avatar-camera-icon">
                  <Camera size={44} />
                  <span className="wa-group-avatar-hint">AÑADIR FOTO DEL GRUPO</span>
                </div>
              )}
            </div>
          </div>

          {/* Input Asunto del grupo subrayado en verde */}
          <div className="wa-group-subject-wrap">
            <div className="wa-group-subject-input-box">
              <input
                ref={subjectInputRef}
                type="text"
                className="wa-group-subject-input"
                placeholder="Asunto del grupo (opcional)"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={100}
                autoFocus
              />
              <button
                type="button"
                className="wa-group-emoji-trigger"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                title="Añadir emoji"
              >
                <Smile size={22} />
              </button>
            </div>
            <div className="wa-group-subject-line" />

            {/* Descripción opcional */}
            <div style={{ marginTop: '16px' }}>
              <input
                type="text"
                className="wa-group-subject-input"
                placeholder="Descripción del grupo (opcional)"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                maxLength={255}
                style={{ fontSize: '14px', color: '#8696a0' }}
              />
              <div style={{ height: '1px', background: 'rgba(134, 150, 160, 0.2)', marginTop: '4px' }} />
            </div>

            {/* Selector emergente de emojis */}
            {showEmojiPicker && (
              <div className="wa-emoji-picker-dropdown">
                {EMOJIS_POPULARES.map(em => (
                  <button
                    key={em}
                    type="button"
                    className="wa-emoji-pick-btn"
                    onClick={() => {
                      setNombre(prev => prev + em);
                      setShowEmojiPicker(false);
                      subjectInputRef.current?.focus();
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filas de opciones estilo WhatsApp Desktop */}
          <div className="wa-group-options-list">
            {/* Mensajes temporales */}
            <div
              className="wa-group-option-row"
              onClick={() => setModalTemporalesOpen(true)}
            >
              <div className="wa-group-option-icon">
                <Clock size={20} />
              </div>
              <div className="wa-group-option-text">
                <div className="wa-group-option-title">Mensajes temporales</div>
                <div className="wa-group-option-subtitle">
                  {getTextoTemporales(mensajesTemporales)}
                </div>
              </div>
              <ChevronRight size={18} className="wa-group-option-chevron" />
            </div>

            {/* Permisos del grupo */}
            <div
              className="wa-group-option-row"
              onClick={() => setPaso(3)}
            >
              <div className="wa-group-option-icon">
                <ShieldCheck size={20} />
              </div>
              <div className="wa-group-option-text">
                <div className="wa-group-option-title">Permisos del grupo</div>
                <div className="wa-group-option-subtitle">
                  Ajustes de edición, mensajes y aprobaciones
                </div>
              </div>
              <ChevronRight size={18} className="wa-group-option-chevron" />
            </div>
          </div>

          {error && <div className="wa-drawer-error-alert">{error}</div>}

          {/* Botón flotante verde de confirmación / Crear */}
          <div className="wa-floating-btn-wrap">
            <button
              type="button"
              className={`wa-floating-action-btn ${!nombre.trim() || guardando ? 'disabled' : ''}`}
              disabled={!nombre.trim() || guardando}
              onClick={handleSubmit}
              title="Crear grupo"
            >
              <Check size={26} strokeWidth={3} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          PASO 3: PERMISOS DEL GRUPO (SUB-PANEL)
      ======================================================== */}
      {paso === 3 && (
        <div className="wa-drawer-body wa-step3-body">
          <div className="wa-permissions-header-label">Los miembros pueden:</div>

          <div className="wa-permissions-list">
            {/* 1. Editar ajustes del grupo */}
            <div className="wa-permission-item">
              <div className="wa-permission-texts">
                <div className="wa-permission-title">Editar ajustes del grupo</div>
                <div className="wa-permission-desc">
                  Incluye el nombre, el ícono, la descripción, el temporizador de mensajes y la opción de conservar mensajes.
                </div>
              </div>
              <label className="wa-toggle-switch">
                <input
                  type="checkbox"
                  checked={permisos.editar_ajustes}
                  onChange={() => handleTogglePermiso('editar_ajustes')}
                />
                <span className="wa-toggle-slider" />
              </label>
            </div>

            {/* 2. Enviar nuevos mensajes */}
            <div className="wa-permission-item">
              <div className="wa-permission-texts">
                <div className="wa-permission-title">Enviar nuevos mensajes</div>
              </div>
              <label className="wa-toggle-switch">
                <input
                  type="checkbox"
                  checked={permisos.enviar_mensajes}
                  onChange={() => handleTogglePermiso('enviar_mensajes')}
                />
                <span className="wa-toggle-slider" />
              </label>
            </div>

            {/* 3. Añadir a otros miembros */}
            <div className="wa-permission-item">
              <div className="wa-permission-texts">
                <div className="wa-permission-title">Añadir a otros miembros</div>
              </div>
              <label className="wa-toggle-switch">
                <input
                  type="checkbox"
                  checked={permisos.agregar_miembros}
                  onChange={() => handleTogglePermiso('agregar_miembros')}
                />
                <span className="wa-toggle-slider" />
              </label>
            </div>
          </div>

          <div className="wa-permissions-header-label" style={{ marginTop: '24px' }}>
            Los administradores pueden:
          </div>

          <div className="wa-permissions-list">
            {/* 4. Aprobar miembros nuevos */}
            <div className="wa-permission-item">
              <div className="wa-permission-texts">
                <div className="wa-permission-title">Aprobar miembros nuevos</div>
                <div className="wa-permission-desc">
                  Cuando está activada, los administradores deben aprobar a cualquiera que quiera unirse al grupo.
                </div>
              </div>
              <label className="wa-toggle-switch">
                <input
                  type="checkbox"
                  checked={permisos.aprobar_miembros}
                  onChange={() => handleTogglePermiso('aprobar_miembros')}
                />
                <span className="wa-toggle-slider" />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: MENSAJES TEMPORALES (ESTILO WHATSAPP DESKTOP)
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
                    name="mensajes_temporales"
                    value={opt.id}
                    checked={mensajesTemporales === opt.id}
                    onChange={() => {
                      setMensajesTemporales(opt.id);
                    }}
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
    </div>
  );
};

export default CrearGrupoWhatsAppDrawer;
