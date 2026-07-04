/**
 * @file App.js
 * @description Componente raíz de la aplicación CRM.
 *
 * Responsabilidades de este archivo:
 *   - Instanciar la conexión Socket.io (singleton por sesión de navegador).
 *   - Componer los hooks de estado (auth, conversaciones, socket, notificaciones).
 *   - Renderizar el layout principal (Sidebar + TopBar + vista activa).
 *   - Filtrar las conversaciones visibles según:
 *       1. El estado de la conversación (excluir flujo de menú puro del bot).
 *       2. El rol del agente (admin ve todo; asesor ve su área).
 *       3. El filtro de pestaña activo ("Todos" o "Mis Asignados").
 *       4. El selector de empresa (filtro visual client-side — no dispara fetch).
 *   - Delegar la lógica de negocio a los hooks; este componente no hace llamadas HTTP directas.
 *
 * Diseño multi-empresa:
 *   Todas las conversaciones de todas las empresas se cargan en memoria desde el inicio.
 *   El selector de empresa en el TopBar filtra la lista visualmente pero NO recarga datos.
 *   Los contadores de no-leídos y notificaciones funcionan para todas las empresas
 *   sin importar cuál esté seleccionada, para que el agente no pierda ningún chat pendiente.
 *
 * Vistas disponibles (controladas por `currentView`):
 *   'chat'      → Panel de conversaciones (ChatList + ChatWindow)
 *   'agents'    → Gestión de agentes
 *   'config'    → Configuración del sistema
 *   'dashboard' → KPIs y estadísticas
 *   'contactos' → Directorio de clientes
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { io } from 'socket.io-client';

import { useAuth }           from './hooks/useAuth';
import { useNotifications }  from './hooks/useNotifications';
import { useConversaciones } from './hooks/useConversaciones';
import { useSocket }         from './hooks/useSocket';
import { usePermisos }       from './hooks/usePermisos';
import { apiService }        from './services/api';
import usePolling            from './hooks/usePolling';

import Sidebar             from './components/Layout/Sidebar';
import TopBar              from './components/Layout/TopBar';
import ChatList            from './components/Chat/ChatList';
import ChatWindow          from './components/Chat/ChatWindow';
import SettingsView        from './components/Settings/SettingsView';
import EtiquetasSection    from './components/Settings/sections/EtiquetasSection';
import CategoriasCierreSection from './components/Settings/sections/CategoriasCierreSection';
import AgentManagementView from './components/Settings/AgentManagementView';
import DashboardView       from './components/Settings/DashboardView';
import ContactsView        from './components/Contacts/ContactsView';
import InfraccionesView    from './components/Infracciones/InfraccionesView';
import FlowEditorView     from './components/FlowEditor/FlowEditorView';
import CerrarChatModal     from './components/Chat/CerrarChatModal';
import TransferModal       from './components/Chat/TransferModal';
import Login               from './components/Auth/Login';
import TIPanel             from './components/TI/TIPanel';
import './styles/ti-panel.css';

/** Conexión Socket.io (singleton): se crea una vez al cargar la app. */
// En producción nginx proxea Socket.io por el mismo puerto que el frontend.
// En desarrollo apunta directamente al puerto 3009 del backend.
const SOCKET_URL = process.env.NODE_ENV === 'production'
  ? window.location.origin
  : (process.env.REACT_APP_API_URL || `http://${window.location.hostname}:3009`);
const socket = io(SOCKET_URL);

/**
 * Estados del bot que corresponden al flujo de menú puro.
 * Estas conversaciones no se muestran en la bandeja de entrada de ningún agente.
 */
const ESTADOS_PURO_BOT = ['abierta', 'MENU_PRINCIPAL', 'SELECCION_EMPRESA', 'SELECCION_AREA'];

function App() {
  const { user, login, logout, actualizarUsuario } = useAuth();
  const { notify }                = useNotifications();
  const { hasModulo, filtrarEmpresas } = usePermisos(user, socket);
  const [mantenimiento, setMantenimiento] = useState(false);

  // Escuchar evento de mantenimiento:
  //   1. DOM: disparado por api.js cuando el backend retorna 503 (fallback para peticiones HTTP)
  //   2. Socket: disparado en tiempo real por TI al activar/desactivar mantenimiento
  useEffect(() => {
    const domHandler = () => setMantenimiento(true);
    window.addEventListener('sistema:mantenimiento', domHandler);

    const socketHandler = ({ activo }) => {
      if (activo) {
        setMantenimiento(true);
      } else {
        // Al reactivar: recargar la página para restaurar el estado completo del CRM
        window.location.reload();
      }
    };
    socket.on('sistema:mantenimiento', socketHandler);

    return () => {
      window.removeEventListener('sistema:mantenimiento', domHandler);
      socket.off('sistema:mantenimiento', socketHandler);
    };
  }, []);

  // Estado de UI persistido en localStorage
  // En móvil el sidebar arranca oculto para no tapar el contenido
  const [sidebarVisible, setSidebarVisible] = useState(() => window.innerWidth > 768);
  const [currentView,       setCurrentView]       = useState(() => localStorage.getItem('app_current_view') || 'chat');
  const [totalInfracciones, setTotalInfracciones] = useState(0);
  const [cerrarModalId,     setCerrarModalId]     = useState(null);
  const [transferModalId,   setTransferModalId]   = useState(null);
  const [darkMode,          setDarkMode]          = useState(() => localStorage.getItem('app_theme') === 'dark');

  // Empresa activa: usada solo como filtro visual y para configuración.
  // 'todas' por defecto para que el agente vea todo desde el primer momento.
  const [empresaId, setEmpresaId] = useState(() => localStorage.getItem('app_empresa_id') || 'todas');

  // Estado de filtros del chat
  const [filtro,             setFiltro]             = useState('Todos los chats');
  const [busqueda,           setBusqueda]           = useState('');
  const [texto,              setTexto]              = useState('');
  const [clienteEscribiendo, setClienteEscribiendo] = useState(false);

  // Estado y acciones de conversaciones (carga siempre TODAS las empresas)
  const {
    conversaciones,      setConversaciones,
    conversacionActiva,  setConversacionActiva,
    mensajes,            setMensajes,
    config,              setConfig,
    cargar,
    cargarMensajes,
    enviarMensaje,
    enviarMedia,
    cerrarChat,
    eliminarChat
  } = useConversaciones(user, empresaId);

  const convActivaRef = useRef(conversacionActiva);
  useEffect(() => {
    convActivaRef.current = conversacionActiva;
  }, [conversacionActiva]);

  // Eventos en tiempo real vía Socket.io
  useSocket({
    socket,
    user,
    empresaId,
    conversacionActiva,
    setConversaciones,
    setMensajes,
    setConversacionActiva,
    setClienteEscribiendo,
    notify
  });

  // Polling de respaldo e inyección en tiempo real
  usePolling({
    defaultInterval: 5000,
    longInterval: 15000,
    idleCycles: 3,
    onNewData: (updates, activeAgents) => {
      // Disparar evento global para actualizar tarjetas de agentes sin recargar
      if (activeAgents) {
        window.dispatchEvent(new CustomEvent('agentes:presencia_polling', { detail: activeAgents }));
      }

      if (!updates || updates.length === 0) return;
      
      updates.forEach(upd => {
        // Adaptar estructura dependiendo si es Meta o Telegram
        const isMeta = upd.source === 'meta';
        const telefonoRemitente = isMeta 
          ? (upd.data?.from || '') 
          : (upd.data?.message?.from?.id || '');
          
        const textoMsj = isMeta 
          ? (upd.data?.text?.body || 'Mensaje nuevo') 
          : (upd.data?.message?.text || 'Mensaje nuevo');

        if (!telefonoRemitente) return;
        
        // Determinar si el mensaje entrante es del chat que actualmente estamos viendo
        const currentConv = convActivaRef.current;
        const esChatActivo = currentConv && (
          currentConv.username === String(telefonoRemitente) || 
          currentConv.telefono === String(telefonoRemitente)
        );
        
        // 1. Actualizar bandeja de conversaciones
        setConversaciones(prev => {
          const idx = prev.findIndex(c => 
            c.username === String(telefonoRemitente) || 
            c.telefono === String(telefonoRemitente)
          );
          
          if (idx === -1) return prev; // Si no está en memoria, el websocket/backend se encargará
          
          const conv = prev[idx];
          // Evitamos pisar si el mensaje por socket llegó antes (timestamp check)
          const newTime = new Date(upd.timestamp).getTime();
          const oldTime = new Date(conv.fecha_ultimo_mensaje || 0).getTime();
          if (newTime <= oldTime) return prev; 

          const updated = {
            ...conv,
            ultimo_mensaje: textoMsj,
            ultimo_remitente: 'user',
            fecha_ultimo_mensaje: upd.timestamp,
            // Solo incrementar si NO es el chat activo (comportamiento WhatsApp)
            no_leidos: !esChatActivo 
              ? String(parseInt(conv.no_leidos || 0) + 1)
              : conv.no_leidos,
          };
          return [updated, ...prev.filter((_, i) => i !== idx)];
        });

        // 2. Insertar en la vista de chat si está activa
        if (esChatActivo) {
          const newMsg = {
            id: `poll_${upd.timestamp}_${Math.random()}`,
            remitente: 'user',
            texto: textoMsj,
            tipo: 'text',
            created_at: upd.timestamp,
          };
          
          setMensajes(prev => [...prev, newMsg]);
          
          // Marcar en la base de datos como leído porque lo acabamos de ver
          if (currentConv && currentConv.id) {
            apiService.marcarLeido(currentConv.id).catch(() => {});
          }
        }
      });
    }
  });

  // Cargar conteo de infracciones de hoy y escuchar nuevas en tiempo real (solo admin)
  useEffect(() => {
    if (!user || user.rol !== 'admin') return;
    apiService.getInfraccionesHoy(user.id, empresaId)
      .then(data => setTotalInfracciones(data.total || 0))
      .catch(() => {});
  }, [user, empresaId]);

  useEffect(() => {
    if (!user || user.rol !== 'admin') return;
    const handler = () => setTotalInfracciones(prev => prev + 1);
    socket.on('nueva_infraccion', handler);
    return () => socket.off('nueva_infraccion', handler);
  }, [user]);

  // Unirse a la sala de Socket.io. Se re-emite también en cada reconexión
  // para recuperar las salas que el servidor pierde al reiniciarse.
  useEffect(() => {
    if (!user) return;
    const joinRoom = () => socket.emit('agente:join', { id: user.id, rol: user.rol, area: user.area });
    joinRoom();
    socket.on('connect', joinRoom);
    return () => socket.off('connect', joinRoom);
  }, [user]);

  // Persistir preferencias en localStorage; limpiar badge de infracciones al entrar a esa vista
  useEffect(() => {
    localStorage.setItem('app_current_view', currentView);
    if (currentView === 'infracciones') setTotalInfracciones(0);
  }, [currentView]);
  useEffect(() => { localStorage.setItem('app_empresa_id', empresaId); }, [empresaId]);

  // Persistir preferencia de tema (solo afecta al chat)
  useEffect(() => {
    localStorage.setItem('app_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Cerrar chat activo al presionar Escape
  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape') setConversacionActiva(null); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [setConversacionActiva]);

  // Actualizar foto de perfil en sesión cuando el usuario edita su propio avatar
  useEffect(() => {
    const handler = (e) => {
      if (user && e.detail.id === user.id) {
        actualizarUsuario({ foto_perfil: e.detail.foto_perfil });
      }
    };
    window.addEventListener('agente:foto-actualizada', handler);
    return () => window.removeEventListener('agente:foto-actualizada', handler);
  }, [user, actualizarUsuario]);

  // ─────────────────────────────────────────────
  // Total de no-leídos global (todas las empresas)
  // Se pasa al Sidebar para mostrar el badge de alerta en el menú de Chat.
  // ─────────────────────────────────────────────
  const totalNoLeidos = useMemo(() =>
    conversaciones.reduce((sum, c) => sum + parseInt(c.no_leidos || 0), 0),
    [conversaciones]
  );

  // Actualizar título de la pestaña con contador de no leídos
  useEffect(() => {
    document.title = totalNoLeidos > 0 ? `(${totalNoLeidos}) ISP CRM` : 'ISP CRM';
  }, [totalNoLeidos]);

  // ─────────────────────────────────────────────
  // Filtrado de conversaciones
  //
  // Orden de filtros aplicados:
  //   1. Búsqueda por nombre / username
  //   2. Excluir conversaciones de menú puro del bot
  //   3. Filtro de empresa (client-side, sobre datos ya en memoria)
  //   4. Filtro de pestaña activa (Todos / Mis Asignados)
  // ─────────────────────────────────────────────
  const conversacionesFiltradas = conversaciones.filter(c => {
    // 1. Búsqueda
    const search = busqueda.toLowerCase();
    if (search) {
      const matchNombre   = (c.nombre   || '').toLowerCase().includes(search);
      const matchUsername = (c.username || '').toLowerCase().includes(search);
      if (!matchNombre && !matchUsername) return false;
    }

    // 2. Excluir flujo de menú del bot
    if (ESTADOS_PURO_BOT.includes(c.estado)) return false;

    // 3. Filtro de empresa (visual, no recarga datos del servidor)
    if (empresaId !== 'todas' && c.empresa_id !== empresaId) return false;

    // 4. Filtro de pestaña
    const esCerrado = c.estado === 'cerrada' || c.estado?.startsWith('ENCUESTA');

    if (filtro === 'Todos los chats') {
      // Los cerrados van a su propio apartado — nunca aparecen aquí
      if (esCerrado) return false;
      if (user?.rol === 'admin') return true;
      // Asesor: conversaciones sin agente asignado (en espera de atención)
      return !c.agente_id;
    }

    if (filtro === 'Mis Asignados') {
      if (esCerrado) return false;
      return Number(c.agente_id) === Number(user?.id);
    }

    if (filtro === 'Cerrados') {
      if (!esCerrado) return false;
      // Admin ve todos los cerrados de todas las áreas
      if (user?.rol === 'admin') return true;
      // Asesor: cerrados de su área (el backend filtra por departamento)
      return c.departamento === user?.area;
    }

    return false;
  });

  // ─────────────────────────────────────────────
  // Handlers con UX (confirm / prompt) sobre las acciones del hook
  // ─────────────────────────────────────────────

  const handleCerrarChat = (id) => setCerrarModalId(id);

  const handleConfirmarCierre = async (categoria_cierre_id, comentario_cierre) => {
    try {
      await cerrarChat(cerrarModalId, categoria_cierre_id, comentario_cierre);
    } catch (err) {
      // 409: la conversación ya estaba cerrada (doble clic, race condition).
      // No hay nada que hacer — cerrar el modal sin mostrar error.
      if (!err.message?.includes('ya está cerrada')) throw err;
    }
    setCerrarModalId(null);
  };

  const handleTransferirChat = (id) => setTransferModalId(id);

  const handleConfirmarTransferencia = async (areaDestino, nota) => {
    if (!transferModalId) return;
    try {
      await apiService.transferirChat(transferModalId, areaDestino, nota);
      setTransferModalId(null);
      setConversacionActiva(null);
    } catch (err) {
      alert(err.message || 'Error al transferir el chat');
    }
  };

  const handleEliminarChat = async (id) => {
    if (window.confirm('¿Eliminar permanentemente?')) await eliminarChat(id);
  };

  const handleEnviarMensaje = async () => {
    if (!texto) return;
    const msg = texto;
    setTexto('');
    await enviarMensaje(msg);
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  if (!user)             return <Login onLoginSuccess={login} />;
  if (user.rol === 'ti') return <TIPanel user={user} logout={logout} />;

  // Pantalla de mantenimiento para admin/asesor mientras TI trabaja
  if (mantenimiento) {
    return (
      <div className="mnt-screen">
        <img src="/fibri.png" alt="Fibri" className="mnt-fibri" />
        <div className="mnt-title">Sistema en mantenimiento</div>
        <p className="mnt-text">El equipo de TI está realizando tareas de mantenimiento. El sistema estará disponible en breve.</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Backdrop para cerrar el sidebar en móvil */}
      {sidebarVisible && (
        <div className="sidebar-backdrop" onClick={() => setSidebarVisible(false)} />
      )}
      <Sidebar
        visible={sidebarVisible}
        currentView={currentView}
        setView={(v) => { setCurrentView(v); if (window.innerWidth <= 768) setSidebarVisible(false); }}
        user={user}
        onLogout={logout}
        totalNoLeidos={totalNoLeidos}
        totalInfracciones={totalInfracciones}
        hasModulo={hasModulo}
      />
      <div className="main-wrapper">
        <TopBar
          sidebarVisible={sidebarVisible}
          setSidebarVisible={setSidebarVisible}
          empresaId={empresaId}
          setEmpresaId={setEmpresaId}
          user={user}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
        />
        <div className={`main-content${conversacionActiva ? ' has-active-chat' : ''}${darkMode && currentView === 'chat' ? ' chat-dark' : ''}`}>

          {currentView === 'chat' && (
            <>
              <ChatList
                conversaciones={conversacionesFiltradas}
                conversacionActiva={conversacionActiva}
                setConversacionActiva={setConversacionActiva}
                cargarMensajes={cargarMensajes}
                busqueda={busqueda}   setBusqueda={setBusqueda}
                filtro={filtro}       setFiltro={setFiltro}
                user={user}
              />
              <ChatWindow
                conversacionActiva={conversacionActiva}
                mensajes={mensajes}
                setMensajes={setMensajes}
                texto={texto}                         setTexto={setTexto}
                enviarMensaje={handleEnviarMensaje}
                enviarMedia={enviarMedia}
                cerrarConversacion={handleCerrarChat}
                transferirConversacion={handleTransferirChat}
                eliminarConversacion={handleEliminarChat}
                setConversacionActiva={setConversacionActiva}
                clienteEscribiendo={clienteEscribiendo}
                user={user}
                darkMode={darkMode}
              />
            </>
          )}

          {currentView === 'agents' && (
            <AgentManagementView user={user} actualizarUsuario={actualizarUsuario} />
          )}

          {currentView === 'config' && (
            <SettingsView
              config={config}
              setConfig={setConfig}
              empresaId={empresaId}
              user={user}
              onSave={async (clave, valor) => {
                await apiService.updateConfig(clave, valor, empresaId);
                await cargar();
              }}
            />
          )}

          {currentView === 'dashboard' && (
            <DashboardView user={user} empresaId={empresaId} socket={socket} />
          )}

          {currentView === 'contactos' && <ContactsView />}

          {currentView === 'infracciones' && (
            <InfraccionesView user={user} empresaId={empresaId} socket={socket} />
          )}

          {currentView === 'etiquetas' && (
            <EtiquetasSection empresaId={empresaId} user={user} />
          )}

          {currentView === 'categorias-cierre' && (
            <CategoriasCierreSection empresaId={empresaId} user={user} />
          )}

          {currentView === 'flow-editor' && (
            <FlowEditorView empresaId={empresaId !== 'todas' ? empresaId : 'fibratec'} user={user} />
          )}

          {!['chat','agents','config','dashboard','contactos','infracciones','etiquetas','categorias-cierre','flow-editor'].includes(currentView) && (
            <div className="empty-chat">
              <div className="empty-content"><h2>Próximamente</h2></div>
            </div>
          )}

        </div>
      </div>
      {cerrarModalId && (
        <CerrarChatModal
          clienteNombre={conversaciones.find(c => c.id === cerrarModalId)?.nombre}
          conversacion={conversaciones.find(c => c.id === cerrarModalId)}
          user={user}
          onConfirmar={handleConfirmarCierre}
          onCancelar={() => setCerrarModalId(null)}
        />
      )}
      {transferModalId && (
        <TransferModal
          clienteNombre={conversaciones.find(c => c.id === transferModalId)?.nombre}
          areaActual={
            conversaciones.find(c => c.id === transferModalId)?.departamento
            || user?.area
          }
          onConfirmar={handleConfirmarTransferencia}
          onCancelar={() => setTransferModalId(null)}
        />
      )}
    </div>
  );
}

export default App;
