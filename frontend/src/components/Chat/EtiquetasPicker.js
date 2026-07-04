import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Tag, X, Search, ChevronDown, Check } from 'lucide-react';
import { apiService } from '../../services/api';
import { EtiquetaChip } from '../Settings/sections/EtiquetasSection';

const EtiquetasPicker = ({
  conversacion,
  etiquetas,        // array actual de etiquetas de la conversación
  onEtiquetasChange // callback(nuevasEtiquetas)
}) => {
  const [open,         setOpen]         = useState(false);
  const [catalogo,     setCatalogo]     = useState([]);
  const [busqueda,     setBusqueda]     = useState('');
  const [cargando,     setCargando]     = useState(false);
  const [guardando,    setGuardando]    = useState(null); // id que se está procesando
  const dropRef = useRef(null);

  const cargarCatalogo = useCallback(async () => {
    if (!conversacion?.empresa_id) return;
    setCargando(true);
    try {
      const data = await apiService.listarEtiquetas(conversacion.empresa_id);
      setCatalogo(data);
    } catch { /* ignorar */ }
    finally { setCargando(false); }
  }, [conversacion?.empresa_id]);

  // Abrir dropdown y cargar catálogo
  const toggleOpen = () => {
    if (!open) cargarCatalogo();
    setOpen(s => !s);
    setBusqueda('');
  };

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const asignadas = new Set((etiquetas || []).map(e => e.id));

  const toggle = async (etq) => {
    if (guardando) return;
    setGuardando(etq.id);
    try {
      let nuevas;
      if (asignadas.has(etq.id)) {
        nuevas = await apiService.quitarEtiqueta(conversacion.id, etq.id);
      } else {
        nuevas = await apiService.asignarEtiqueta(conversacion.id, etq.id);
      }
      onEtiquetasChange(nuevas);
    } catch (e) {
      console.error('Error al cambiar etiqueta:', e.message);
    } finally {
      setGuardando(null);
    }
  };

  const catalogoFiltrado = catalogo.filter(e =>
    !busqueda || e.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="etq-picker" ref={dropRef}>
      {/* Chips de las etiquetas aplicadas */}
      <div className="etq-applied">
        {(etiquetas || []).map(e => (
          <EtiquetaChip
            key={e.id}
            nombre={e.nombre}
            color={e.color}
            onRemove={() => toggle(e)}
          />
        ))}

        {/* Botón para abrir el selector */}
        <button
          className={`etq-add-btn${open ? ' active' : ''}`}
          onClick={toggleOpen}
          title="Etiquetar conversación"
        >
          <Tag size={12} />
          <span>Etiquetar</span>
          <ChevronDown size={10} className={`etq-chevron${open ? ' rotated' : ''}`} />
        </button>
      </div>

      {/* Dropdown del catálogo */}
      {open && (
        <div className="etq-dropdown">
          <div className="etq-dropdown-search">
            <Search size={13} />
            <input
              autoFocus
              type="text"
              placeholder="Buscar…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button onClick={() => setBusqueda('')}><X size={12} /></button>
            )}
          </div>

          <div className="etq-dropdown-list">
            {cargando ? (
              <div className="etq-dropdown-empty">Cargando…</div>
            ) : catalogoFiltrado.length === 0 ? (
              <div className="etq-dropdown-empty">
                {busqueda ? 'Sin resultados' : 'No hay etiquetas'}
              </div>
            ) : (
              catalogoFiltrado.map(etq => {
                const activa = asignadas.has(etq.id);
                return (
                  <button
                    key={etq.id}
                    className={`etq-dropdown-item${activa ? ' selected' : ''}`}
                    onClick={() => toggle(etq)}
                    disabled={guardando === etq.id}
                  >
                    <span className="etq-dropdown-preview">
                      <EtiquetaChip nombre={etq.nombre} color={etq.color} />
                      {etq.area && (
                        <span className="etq-dropdown-area">{etq.area}</span>
                      )}
                    </span>
                    {activa && <Check size={13} className="etq-check-icon" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EtiquetasPicker;
