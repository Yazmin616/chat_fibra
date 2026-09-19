import React, { useState, useEffect, useCallback } from 'react';
import { Settings, LogOut, Download, Trash2, RefreshCw, AlertTriangle, CheckCircle, Server, Layers, MessageSquare, Wrench } from 'lucide-react';
import { API_URL } from '../../services/api';
import ChatInternoView from '../ChatInterno/ChatInternoView';
import TicketsView from './Tickets/TicketsView';
import '../../styles/ti-panel.css';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('agente_token') || ''}`,
});

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_URL}/ti${path}`, {
    headers: authHeaders(),
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res;
}

function fmt(n) {
  return Number(n || 0).toLocaleString('es-MX');
}

// ────────────────────────────────────────────────────────────────────────────
const TIPanel = ({ user, logout, socket }) => {
  const [tabActivo,     setTabActivo]     = useState('mantenimiento'); // 'mantenimiento' | 'tickets' | 'chat'
  const [status,        setStatus]        = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [logs,          setLogs]          = useState([]);
  const [loadingLogs,   setLoadingLogs]   = useState(false);

  // Purga
  const [meses,           setMeses]           = useState(6);
  const [purgaPreview,    setPurgaPreview]     = useState(null);
  const [confirmPurga,    setConfirmPurga]     = useState(false);
  const [loadingPurga,    setLoadingPurga]     = useState(false);
  const [purgaResult,     setPurgaResult]      = useState(null);

  // Mantenimiento
  const [loadingMnt, setLoadingMnt] = useState(false);

  // Backup
  const [loadingBackup,    setLoadingBackup]    = useState(false);
  const [backupDescargado, setBackupDescargado] = useState(false);

  // Limpiar BD
  const [confirmLimpiar,    setConfirmLimpiar]    = useState(false);
  const [loadingLimpiar,    setLoadingLimpiar]    = useState(false);
  const [limpiarResult,     setLimpiarResult]     = useState(null);

  // Stickers
  const [stickers,             setStickers]            = useState([]);
  const [loadingStickers,      setLoadingStickers]     = useState(false);
  const [confirmDeleteSticker, setConfirmDeleteSticker]= useState(null); // {pack, file, favoritos}
  const [loadingDeleteSticker, setLoadingDeleteSticker]= useState(false);

  // Error general
  const [error, setError] = useState('');

  const cargarStatus = useCallback(async () => {
    setLoadingStatus(true);
    setError('');
    try {
      const res  = await apiFetch('/status');
      const data = await res.json();
      setStatus(data);
    } catch (e) { setError(e.message); }
    finally { setLoadingStatus(false); }
  }, []);

  const cargarLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res  = await apiFetch('/logs?n=100');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (_) {}
    finally { setLoadingLogs(false); }
  }, []);

  const cargarPurgaPreview = useCallback(async (m) => {
    try {
      const res  = await apiFetch(`/purga-preview?meses=${m}`);
      const data = await res.json();
      setPurgaPreview(data.elegibles);
    } catch (_) {}
  }, []);

  const cargarStickers = useCallback(async () => {
    setLoadingStickers(true);
    try {
      const res  = await apiFetch('/stickers');
      const data = await res.json();
      setStickers(data || []);
    } catch (_) { setStickers([]); }
    finally { setLoadingStickers(false); }
  }, []);

  useEffect(() => { cargarStatus(); cargarLogs(); cargarStickers(); }, [cargarStatus, cargarLogs, cargarStickers]);
  useEffect(() => { cargarPurgaPreview(meses); }, [meses, cargarPurgaPreview]);

  // Recargar logs cada 10 s
  useEffect(() => {
    const id = setInterval(cargarLogs, 10000);
    return () => clearInterval(id);
  }, [cargarLogs]);

  // ── Mantenimiento ──────────────────────────────────────────────────────────
  const toggleMnt = async () => {
    const nuevoEstado = !status?.mantenimiento;
    setLoadingMnt(true);
    try {
      await apiFetch('/mantenimiento', {
        method: 'POST',
        body: JSON.stringify({ activo: nuevoEstado }),
      });
      await cargarStatus();
      await cargarLogs();
    } catch (e) { setError(e.message); }
    finally { setLoadingMnt(false); }
  };

  // ── Backup ─────────────────────────────────────────────────────────────────
  const descargarBackup = async () => {
    setLoadingBackup(true);
    setError('');
    try {
      const res  = await fetch(`${API_URL}/ti/backup`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Error al generar respaldo');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const fecha = new Date().toISOString().slice(0, 10);
      a.href     = url;
      a.download = `backup_ispchatbot_${fecha}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupDescargado(true);
    } catch (e) { setError(e.message); }
    finally { setLoadingBackup(false); }
  };

  // ── Limpiar BD ─────────────────────────────────────────────────────────────
  const ejecutarLimpiarBD = async () => {
    setLoadingLimpiar(true);
    setLimpiarResult(null);
    try {
      await apiFetch('/limpiar-bd', {
        method: 'POST',
        body: JSON.stringify({ confirmado: true }),
      });
      setLimpiarResult({ ok: true });
      await cargarStatus();
    } catch (e) { setLimpiarResult({ ok: false, msg: e.message }); }
    finally { setLoadingLimpiar(false); setConfirmLimpiar(false); }
  };

  // ── Purga ──────────────────────────────────────────────────────────────────
  const ejecutarPurga = async () => {
    setLoadingPurga(true);
    setPurgaResult(null);
    try {
      const res  = await apiFetch('/purgar', {
        method: 'POST',
        body: JSON.stringify({ meses, confirmado: true }),
      });
      const data = await res.json();
      setPurgaResult({ ok: true, eliminados: data.eliminados });
      setBackupDescargado(false);
      await cargarStatus();
      await cargarPurgaPreview(meses);
    } catch (e) { setPurgaResult({ ok: false, msg: e.message }); }
    finally { setLoadingPurga(false); setConfirmPurga(false); }
  };

  // ── Stickers ───────────────────────────────────────────────────────────────
  const ejecutarEliminarSticker = async () => {
    if (!confirmDeleteSticker) return;
    setLoadingDeleteSticker(true);
    try {
      const { pack, file } = confirmDeleteSticker;
      await apiFetch(`/stickers/${encodeURIComponent(pack)}/${encodeURIComponent(file)}`, { method: 'DELETE' });
      await cargarStickers();
      setConfirmDeleteSticker(null);
    } catch (e) { setError(e.message); setConfirmDeleteSticker(null); }
    finally { setLoadingDeleteSticker(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const mnt = status?.mantenimiento;

  return (
    <div className="ti-root">

      {/* Header */}
      <header className="ti-header">
        <div className="ti-header-left">
          <div className="ti-logo"><Settings size={17} color="#fff" /></div>
          <span className="ti-title">Panel TI</span>
          <span className="ti-subtitle">ISP Chatbot</span>
        </div>

        {/* Pestañas de Navegación del Panel TI */}
        <div className="ti-nav-tabs">
          <button
            type="button"
            className={`ti-nav-tab ${tabActivo === 'mantenimiento' ? 'active' : ''}`}
            onClick={() => setTabActivo('mantenimiento')}
          >
            <Server size={14} /> Mantenimiento & Sistema
          </button>
          <button
            type="button"
            className={`ti-nav-tab ${tabActivo === 'tickets' ? 'active' : ''}`}
            onClick={() => setTabActivo('tickets')}
          >
            <Wrench size={14} /> Tickets & Solicitudes
          </button>
          <button
            type="button"
            className={`ti-nav-tab ${tabActivo === 'chat' ? 'active' : ''}`}
            onClick={() => setTabActivo('chat')}
          >
            <MessageSquare size={14} /> Chat Interno
          </button>
        </div>

        <div className="ti-header-right">
          <span className="ti-user-badge">{user?.nombre}</span>
          <button className="ti-logout-btn" onClick={logout}>
            <LogOut size={13} /> Salir
          </button>
        </div>
      </header>

      {tabActivo === 'chat' && (
        <div style={{ flex: 1, height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
          <ChatInternoView socket={socket} user={user} darkMode={false} />
        </div>
      )}

      {tabActivo === 'tickets' && (
        <main className="ti-main" style={{ maxWidth: 1240 }}>
          <TicketsView user={user} socket={socket} />
        </main>
      )}

      {tabActivo === 'mantenimiento' && (
        <main className="ti-main">
          {/* Banner de bienvenida con Fibri */}
        <div className="ti-welcome">
          <div className="ti-welcome-text">
            <h2>¡Hola, {user?.nombre?.split(' ')[0]}! 👋</h2>
            <p>Bienvenido al panel de administración técnica del sistema.</p>
          </div>
          <img src="/fibri.png" alt="Fibri" className="ti-fibri" />
        </div>

        {error && (
          <div className="ti-result ti-result-error">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {/* Tarjetas de estado */}
        <div className="ti-cards">
          {[
            { label: 'Mensajes',        value: status?.counts?.mensajes },
            { label: 'Conversaciones',  value: status?.counts?.conversaciones },
            { label: 'Calificaciones',  value: status?.counts?.calificaciones },
            { label: 'Usuarios',        value: status?.counts?.usuarios },
            { label: 'Agentes',         value: status?.counts?.agentes },
            { label: 'Tamaño BD',       value: status?.db?.size, raw: true },
          ].map(c => (
            <div key={c.label} className="ti-card">
              <span className="ti-card-value">
                {loadingStatus ? '—' : (c.raw ? c.value || '—' : fmt(c.value))}
              </span>
              <span className="ti-card-label">{c.label}</span>
            </div>
          ))}
        </div>

        {/* Modo mantenimiento */}
        <div className="ti-section">
          <div className="ti-section-header">
            <span className="ti-section-title"><Server size={13} /> Modo Mantenimiento</span>
            <button
              className="ti-btn ti-btn-outline"
              onClick={cargarStatus}
              style={{ padding: '5px 10px', fontSize: 11, borderRadius: 8 }}
            >
              <RefreshCw size={11} />
            </button>
          </div>
          <div className="ti-section-body">
            <div className="ti-mnt-status">
              <span className={`ti-dot ${mnt ? 'ti-dot-red' : 'ti-dot-green'}`} />
              <span>{mnt ? 'Sistema EN MANTENIMIENTO' : 'Sistema ACTIVO'}</span>
            </div>
            <p className="ti-mnt-desc">
              {mnt
                ? 'Los agentes y clientes de Telegram ven un aviso de mantenimiento. Solo el panel TI sigue accesible.'
                : 'El sistema opera con normalidad. Los agentes pueden atender chats y el bot está activo.'}
            </p>
            <div>
              <button
                className={`ti-btn ${mnt ? 'ti-btn-success' : 'ti-btn-danger'}`}
                onClick={toggleMnt}
                disabled={loadingMnt || loadingStatus}
              >
                {loadingMnt ? <span className="ti-spinner" /> : null}
                {mnt ? 'Reactivar plataforma' : 'Activar mantenimiento'}
              </button>
            </div>
          </div>
        </div>

        {/* Respaldo */}
        <div className="ti-section">
          <div className="ti-section-header">
            <span className="ti-section-title"><Download size={13} /> Respaldo de base de datos</span>
          </div>
          <div className="ti-section-body">
            <div className="ti-backup-row">
              <div>
                <div style={{ fontSize: 14, color: '#111b21', fontWeight: 500, marginBottom: 4 }}>
                  Exporta todas las tablas como archivo JSON descargable
                </div>
                <div className="ti-backup-info">
                  Incluye: mensajes, conversaciones, calificaciones, agentes, usuarios, configuraciones
                </div>
              </div>
              <button
                className="ti-btn ti-btn-primary"
                onClick={descargarBackup}
                disabled={loadingBackup}
              >
                {loadingBackup ? <span className="ti-spinner" /> : <Download size={14} />}
                Descargar respaldo
              </button>
            </div>
            {backupDescargado && (
              <div className="ti-result ti-result-ok">
                <CheckCircle size={14} /> Respaldo descargado. Ahora puedes ejecutar la purga de forma segura.
              </div>
            )}
          </div>
        </div>

        {/* Limpiar base de datos */}
        <div className="ti-section">
          <div className="ti-section-header">
            <span className="ti-section-title"><Trash2 size={13} /> Limpiar base de datos</span>
          </div>
          <div className="ti-section-body">
            <div className="ti-backup-row">
              <div>
                <div style={{ fontSize: 14, color: '#111b21', fontWeight: 500, marginBottom: 4 }}>
                  Elimina todos los datos de prueba (conversaciones, mensajes, usuarios, calificaciones)
                </div>
                <div className="ti-backup-info">
                  Los agentes y configuraciones del sistema NO se eliminan. Los contadores se reinician a 1.
                </div>
              </div>
              <button
                className="ti-btn ti-btn-danger"
                onClick={() => { setLimpiarResult(null); setConfirmLimpiar(true); }}
                disabled={loadingLimpiar}
              >
                <Trash2 size={14} /> Limpiar BD
              </button>
            </div>
            {limpiarResult && (
              <div className={`ti-result ${limpiarResult.ok ? 'ti-result-ok' : 'ti-result-error'}`}>
                {limpiarResult.ok
                  ? <><CheckCircle size={14} /> Base de datos limpiada correctamente. Contadores reiniciados.</>
                  : <><AlertTriangle size={14} /> {limpiarResult.msg}</>}
              </div>
            )}
          </div>
        </div>

        {/* Purga */}
        <div className="ti-section">
          <div className="ti-section-header">
            <span className="ti-section-title"><Trash2 size={13} /> Purga de mensajes</span>
          </div>
          <div className="ti-section-body">
            <div className="ti-purge-row">
              <div>
                <div className="ti-purge-count">{purgaPreview === null ? '—' : fmt(purgaPreview)}</div>
                <div className="ti-purge-label">mensajes elegibles para eliminar</div>
              </div>
              <div className="ti-meses-row">
                <span className="ti-meses-label">Retener los últimos</span>
                <select
                  className="ti-meses-select"
                  value={meses}
                  onChange={e => setMeses(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6, 9, 12].map(m => (
                    <option key={m} value={m}>{m} mes{m > 1 ? 'es' : ''}</option>
                  ))}
                </select>
                <button
                  className="ti-btn ti-btn-danger"
                  onClick={() => setConfirmPurga(true)}
                  disabled={!backupDescargado || (purgaPreview === 0) || loadingPurga}
                  title={!backupDescargado ? 'Descarga el respaldo primero' : ''}
                >
                  <Trash2 size={14} /> Purgar
                </button>
              </div>
            </div>
            {!backupDescargado && (
              <div className="ti-result ti-result-error" style={{ background: '#fffbeb', color: '#92400e', borderColor: '#fde68a' }}>
                <AlertTriangle size={14} /> Descarga el respaldo antes de purgar para tener un punto de restauración.
              </div>
            )}
            {purgaResult && (
              <div className={`ti-result ${purgaResult.ok ? 'ti-result-ok' : 'ti-result-error'}`}>
                {purgaResult.ok
                  ? <><CheckCircle size={14} /> {fmt(purgaResult.eliminados)} mensajes eliminados correctamente.</>
                  : <><AlertTriangle size={14} /> {purgaResult.msg}</>}
              </div>
            )}
          </div>
        </div>

        {/* Gestión de stickers */}
        <div className="ti-section">
          <div className="ti-section-header">
            <span className="ti-section-title"><Layers size={13} /> Gestión de stickers</span>
            <button
              className="ti-btn ti-btn-outline"
              onClick={cargarStickers}
              disabled={loadingStickers}
              style={{ padding: '5px 10px', fontSize: 11, borderRadius: 8 }}
            >
              {loadingStickers ? <span className="ti-spinner" style={{ borderTopColor: '#54656f', borderColor: 'rgba(84,101,111,0.3)' }} /> : <RefreshCw size={11} />}
            </button>
          </div>
          <div className="ti-section-body">
            {loadingStickers && !stickers.length ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <span className="ti-spinner" style={{ borderTopColor: '#dc2626', borderColor: 'rgba(220,38,38,0.2)', width: 22, height: 22 }} />
              </div>
            ) : !stickers.length ? (
              <div style={{ color: '#667781', fontSize: 13, padding: '8px 0' }}>
                No hay stickers en <code>uploads/stickers/</code>. Crea subcarpetas con archivos .webp para cada pack.
              </div>
            ) : (
              stickers.map(pack => (
                <div key={pack.pack} className="ti-sticker-pack">
                  <div className="ti-sticker-pack-name">
                    {pack.label || pack.pack}
                    <span className="ti-sticker-pack-count">{pack.files.length} sticker{pack.files.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="ti-sticker-grid">
                    {pack.files.map(s => (
                      <div key={s.file} className="ti-sticker-item">
                        <img
                          src={`${API_URL}/agente/sticker-file/${encodeURIComponent(pack.pack)}/${encodeURIComponent(s.file)}`}
                          alt={s.file}
                          className="ti-sticker-thumb"
                        />
                        {s.favoritos > 0 && (
                          <span className="ti-sticker-fav-count" title={`${s.favoritos} agente${s.favoritos > 1 ? 's' : ''} lo tiene${s.favoritos > 1 ? 'n' : ''} como favorito`}>
                            ♥ {s.favoritos}
                          </span>
                        )}
                        <div className="ti-sticker-footer">
                          <span className="ti-sticker-name" title={s.file}>{s.file.replace(/\.\w+$/, '')}</span>
                          <button
                            className="ti-sticker-del-btn"
                            title="Eliminar permanentemente"
                            onClick={() => setConfirmDeleteSticker({ pack: pack.pack, file: s.file, favoritos: s.favoritos })}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Logs */}
        <div className="ti-section">
          <div className="ti-section-header">
            <span className="ti-section-title">Logs del servidor</span>
            <button
              className="ti-btn ti-btn-outline"
              style={{ padding: '5px 12px', fontSize: 11, borderRadius: 8 }}
              onClick={cargarLogs}
              disabled={loadingLogs}
            >
              {loadingLogs
                ? <span className="ti-spinner" style={{ borderTopColor: '#54656f', borderColor: 'rgba(84,101,111,0.3)' }} />
                : <RefreshCw size={11} />}
              Actualizar
            </button>
          </div>
          <div className="ti-section-body" style={{ padding: 14 }}>
            <div className="ti-logs-box">
              {logs.length === 0
                ? <div className="ti-logs-empty">Sin logs disponibles aún</div>
                : logs.map((l, i) => (
                    <div key={i} className="ti-log-line">
                      <span className="ti-log-ts">{l.ts?.slice(11, 19)}</span>
                      <span className={`ti-log-lvl-${l.level}`}>{l.level?.toUpperCase().slice(0, 4)}</span>
                      <span className="ti-log-msg">{l.message}</span>
                    </div>
                  ))}
            </div>
          </div>
        </div>

      </main>
      )}

      {/* Modal de confirmación de limpiar BD */}
      {confirmLimpiar && (
        <div className="ti-confirm-overlay">
          <div className="ti-confirm-box">
            <div className="ti-confirm-title">
              <AlertTriangle size={18} /> Confirmar limpieza
            </div>
            <p className="ti-confirm-text">
              Se eliminarán <strong style={{ color: '#DC1E1E' }}>TODOS los registros</strong> de:
              conversaciones, mensajes, usuarios de Telegram, calificaciones e infracciones.
              <br /><br />
              Los <strong>agentes y configuraciones</strong> del sistema permanecerán intactos.
              Los contadores de ID se reiniciarán a 1.
              <br /><br />
              Esta acción <strong>no se puede deshacer</strong>.
            </p>
            <div className="ti-confirm-actions">
              <button className="ti-btn ti-btn-outline" onClick={() => setConfirmLimpiar(false)}>
                Cancelar
              </button>
              <button className="ti-btn ti-btn-danger" onClick={ejecutarLimpiarBD} disabled={loadingLimpiar}>
                {loadingLimpiar ? <span className="ti-spinner" /> : <Trash2 size={14} />}
                Sí, limpiar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de purga */}
      {confirmPurga && (
        <div className="ti-confirm-overlay">
          <div className="ti-confirm-box">
            <div className="ti-confirm-title">
              <AlertTriangle size={18} /> Confirmar purga
            </div>
            <p className="ti-confirm-text">
              Se eliminarán permanentemente <strong style={{ color: '#DC1E1E' }}>{fmt(purgaPreview)} mensajes</strong> de
              conversaciones cerradas con más de <strong>{meses} mes{meses > 1 ? 'es' : ''}</strong> de antigüedad.
              <br /><br />
              Esta acción <strong>no se puede deshacer</strong>. Los KPIs y calificaciones no se verán afectados.
            </p>
            <div className="ti-confirm-actions">
              <button className="ti-btn ti-btn-outline" onClick={() => setConfirmPurga(false)}>
                Cancelar
              </button>
              <button className="ti-btn ti-btn-danger" onClick={ejecutarPurga} disabled={loadingPurga}>
                {loadingPurga ? <span className="ti-spinner" /> : <Trash2 size={14} />}
                Sí, purgar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: eliminar sticker */}
      {confirmDeleteSticker && (
        <div className="ti-confirm-overlay">
          <div className="ti-confirm-box">
            <div className="ti-confirm-title">
              <AlertTriangle size={18} /> Eliminar sticker
            </div>
            <div style={{ textAlign: 'center', margin: '12px 0' }}>
              <img
                src={`${API_URL}/agente/sticker-file/${encodeURIComponent(confirmDeleteSticker.pack)}/${encodeURIComponent(confirmDeleteSticker.file)}`}
                alt="sticker"
                style={{ width: 80, height: 80, objectFit: 'contain' }}
              />
            </div>
            <p className="ti-confirm-text">
              ¿Eliminar <strong>{confirmDeleteSticker.file.replace(/\.\w+$/, '')}</strong>{' '}
              del pack <strong>{confirmDeleteSticker.pack}</strong>?
              {confirmDeleteSticker.favoritos > 0 && (
                <>
                  <br /><br />
                  <span style={{ color: '#DC1E1E' }}>
                    ⚠️ {confirmDeleteSticker.favoritos} agente{confirmDeleteSticker.favoritos > 1 ? 's lo tienen' : ' lo tiene'} como favorito.
                  </span>
                </>
              )}
              <br /><br />
              Esta acción <strong>no se puede deshacer</strong>.
            </p>
            <div className="ti-confirm-actions">
              <button className="ti-btn ti-btn-outline" onClick={() => setConfirmDeleteSticker(null)}>
                Cancelar
              </button>
              <button className="ti-btn ti-btn-danger" onClick={ejecutarEliminarSticker} disabled={loadingDeleteSticker}>
                {loadingDeleteSticker ? <span className="ti-spinner" /> : <Trash2 size={14} />}
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TIPanel;
