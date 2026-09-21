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
import NpsDashboardView from './components/Metrics/NpsDashboardView';
import SolucionesStaffView from './components/Metrics/SolucionesStaffView';
import AgentManagementView from './components/Settings/AgentManagementView';
import DashboardView       from './components/Settings/DashboardView';
import ContactsView        from './components/Contacts/ContactsView';
import InfraccionesView    from './components/Infracciones/InfraccionesView';
import FlowEditorView     from './components/FlowEditor/FlowEditorView';
import CerrarChatModal     from './components/Chat/CerrarChatModal';
import TransferModal       from './components/Chat/TransferModal';
import Login               from './components/Auth/Login';
import CambiarPasswordPrimerLogin from './components/Auth/CambiarPasswordPrimerLogin';
import TIPanel             from './components/TI/TIPanel';
import EquiposView         from './components/Equipos/EquiposView';
import ChatInternoView     from './components/ChatInterno/ChatInternoView';
import MuralComunicadosView from './components/Comunicados/MuralComunicadosView';
import TicketsView         from './components/TI/Tickets/TicketsView';
import LogoutModal         from './components/Layout/LogoutModal';
import { useNotificacionesCenter } from './hooks/useNotificacionesCenter';
import FloatingMessengerDock from './components/Messenger/FloatingMessengerDock';
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
  const { user, login, logout, actualizarUsuario } = useAuth(socket);
  const { notify }                = useNotifications();
  const { hasModulo, esCoordinador, loading: loadingPermisos } = usePermisos(user, socket);

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
  const [currentView,       setCurrentView]       = useState(() => localStorage.getItem('app_current_view') || 'dashboard');
  const [canalInternoActivoId, setCanalInternoActivoId] = useState(null);

  const {
    notificaciones,
    unreadCount: notifUnreadCount,
    unreadChatInterno,
    marcarLeida: notifMarcarLeida,
    marcarTodasLeidas: notifMarcarTodasLeidas,
    eliminarNotificacion: notifEliminar,
    limpiarTodas: notifLimpiarTodas,
    floatingChats,
    abrirFloatingChat,
    minimizarFloatingChat,
    cerrarFloatingChat,
    miniChat,
    minimizarMiniChat,
    cerrarMiniChat,
  } = useNotificacionesCenter({ socket, user, currentView, setCurrentView });
  const [totalInfracciones, setTotalInfracciones] = useState(0);
  const [cerrarModalId,     setCerrarModalId]     = useState(null);
  const [transferModalId,   setTransferModalId]   = useState(null);
  const [showLogoutModal,   setShowLogoutModal]   = useState(false);
  const [darkMode,          setDarkMode]          = useState(() => localStorage.getItem('app_theme') === 'dark');

  // Sincronizar tema claro / oscuro en tiempo real cuando se alterne desde TopBar o Chat Interno
  useEffect(() => {
    const handleThemeChanged = (e) => {
      if (e.detail && typeof e.detail.isDark === 'boolean') {
        setDarkMode(e.detail.isDark);
      }
    };
    window.addEventListener('sistema:theme_changed', handleThemeChanged);
    return () => window.removeEventListener('sistema:theme_changed', handleThemeChanged);
  }, []);

  // El modo oscuro solo aplica para los chats (Chat Clientes y Chat Interno), el resto de módulos se mantiene en claro
  const esVistaChat = currentView === 'chat' || currentView === 'chat-interno';
  const chatDarkModeActivo = Boolean(darkMode && esVistaChat);

  useEffect(() => {
    if (chatDarkModeActivo) {
      document.body.classList.add('chat-dark');
    } else {
      document.body.classList.remove('chat-dark');
    }
    return () => {
      document.body.classList.remove('chat-dark');
    };
  }, [chatDarkModeActivo]);

  // Empresa activa: usada solo como filtro visual y para configuración.
  // 'todas' por defecto para que el agente vea todo desde el primer momento.
  const [empresaId, setEmpresaId] = useState(() => localStorage.getItem('app_empresa_id') || 'todas');

  // Redireccionar automáticamente si la vista actual no está permitida para este usuario
  useEffect(() => {
    if (!user || loadingPermisos) return;
    const viewToModuloMap = {
      'dashboard': 'dashboard',
      'comunicados': 'comunicados',
      'nps': 'nps',
      'soluciones': 'soluciones',
      'chat-interno': 'chat_interno',
      'chat': 'chat',
      'contactos': 'contactos',
      'infracciones': 'infracciones',
      'etiquetas': 'etiquetas',
      'categorias-cierre': 'notas_cierre',
      'flow-editor': 'flujo_bot',
      'agents': 'usuarios',
      'equipos': 'equipos',
      'tickets': 'tickets',
      'config': 'configuracion',
    };
    const modRequerido = viewToModuloMap[currentView];
    if (modRequerido && !hasModulo(modRequerido)) {
      const primeraPermitida = Object.keys(viewToModuloMap).find(v => hasModulo(viewToModuloMap[v]));
      if (primeraPermitida) {
        setCurrentView(primeraPermitida);
        localStorage.setItem('app_current_view', primeraPermitida);
      }
    }
  }, [currentView, hasModulo, loadingPermisos, user]);

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
    configLoading,
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

  // Cargar conteo de infracciones de hoy y escuchar nuevas en tiempo real (solo admin y coordinadores)
  useEffect(() => {
    if (!user || (user.rol !== 'admin' && !esCoordinador)) return;
    apiService.getInfraccionesHoy(user.id, empresaId)
      .then(data => setTotalInfracciones(data.total || 0))
      .catch(() => {});
  }, [user, empresaId, esCoordinador]);

  useEffect(() => {
    if (!user || (user.rol !== 'admin' && !esCoordinador)) return;
    const handler = () => setTotalInfracciones(prev => prev + 1);
    socket.on('nueva_infraccion', handler);
    return () => socket.off('nueva_infraccion', handler);
  }, [user, esCoordinador]);

  // Unirse a la sala de Socket.io. Se re-emite también en cada reconexión
  // para recuperar las salas que el servidor pierde al reiniciarse.
  useEffect(() => {
    if (!user) return;
    const joinRoom = () => socket.emit('agente:join', { id: user.id, rol: user.rol, area: user.area });
    joinRoom();
    socket.on('connect', joinRoom);
    return () => socket.off('connect', joinRoom);
  }, [user]);

  // Reenviar eventos de presencia de socket a nivel global de la app
  useEffect(() => {
    const handleOnline = (data) => {
      window.dispatchEvent(new CustomEvent('agente:socket_online', { detail: data }));
    };
    const handleOffline = (data) => {
      window.dispatchEvent(new CustomEvent('agente:socket_offline', { detail: data }));
    };
    const handlePresencia = (data) => {
      window.dispatchEvent(new CustomEvent('agente:socket_presencia', { detail: data }));
    };

    socket.on('agente:online', handleOnline);
    socket.on('agente:offline', handleOffline);
    socket.on('agente:presencia_cambiada', handlePresencia);

    return () => {
      socket.off('agente:online', handleOnline);
      socket.off('agente:offline', handleOffline);
      socket.off('agente:presencia_cambiada', handlePresencia);
    };
  }, []);

  
  // Redirección inteligente si el usuario solo tiene acceso al Chat Interno o módulos específicos
  useEffect(() => {
    if (!user || user.rol === 'admin') return;
    if (currentView === 'tickets') return; // Soporte del sistema / tickets está disponible para todos
    const modMap = {
      'comunicados': 'comunicados',
      'chat-interno': 'chat_interno',
      'chat': 'chat',
      'dashboard': 'dashboard',
      'nps': 'nps',
      'soluciones': 'soluciones',
      'contactos': 'contactos',
      'infracciones': 'infracciones',
      'etiquetas': 'etiquetas',
      'categorias-cierre': 'notas_cierre',
      'flow-editor': 'flujo_bot',
      'agents': 'usuarios',
      'equipos': 'equipos',
      'config': 'configuracion',
      'tickets': 'tickets'
    };

    const modActual = modMap[currentView] || currentView;
    if (!hasModulo(modActual)) {
      if (hasModulo('chat_interno')) {
        setCurrentView('chat-interno');
      } else if (hasModulo('chat')) {
        setCurrentView('chat');
      } else if (hasModulo('dashboard')) {
        setCurrentView('dashboard');
      } else if (hasModulo('soluciones')) {
        setCurrentView('soluciones');
      }
    }
  }, [user, currentView, hasModulo]);

  // Al cerrar sesión (user es null), resetear estados locales de UI para la siguiente sesión
  useEffect(() => {
    if (!user) {
      setCurrentView('dashboard');
      setEmpresaId('todas');
      setFiltro('Todos los chats');
      setBusqueda('');
      if (setConversacionActiva) setConversacionActiva(null);
    }
  }, [user, setConversacionActiva]);

  // Persistir preferencias en localStorage; limpiar badge de infracciones al entrar a esa vista
  useEffect(() => {
    if (user) {
      localStorage.setItem('app_current_view', currentView);
      if (currentView === 'infracciones') setTotalInfracciones(0);
    }
  }, [currentView, user]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('app_empresa_id', empresaId);
    }
  }, [empresaId, user]);

  // Persistir preferencia de tema (solo afecta al chat)
  useEffect(() => {
    if (user) {
      localStorage.setItem('app_theme', darkMode ? 'dark' : 'light');
    }
  }, [darkMode, user]);

  // Cambiar a vista de Chat Interno al hacer clic en notificación del sistema
  useEffect(() => {
    const handleAbrir = (e) => {
      if (e.detail?.canalId) {
        setCurrentView('chat-interno');
      }
    };
    window.addEventListener('sistema:abrir_canal_interno', handleAbrir);
    return () => window.removeEventListener('sistema:abrir_canal_interno', handleAbrir);
  }, []);

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
  // Ignora conversaciones cerradas o en estados puros del bot, para no inflar el contador.
  // ─────────────────────────────────────────────
  const totalNoLeidos = useMemo(() =>
    conversaciones.reduce((sum, c) => {
      const esCerrado = c.estado === 'cerrada' || c.estado?.startsWith('ENCUESTA');
      const esHumano = c.estado === 'ESPERANDO_AGENTE' || c.estado === 'atendiendo';
      if (esCerrado || !esHumano) return sum;
      
      let unreads = parseInt(c.no_leidos || 0);
      if (c.estado === 'ESPERANDO_AGENTE' && unreads === 0) unreads = 1;
      
      return sum + unreads;
    }, 0),
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
    // 1. Búsqueda exhaustiva (nombre, username, teléfono, mensaje reciente, área o agente)
    const search = busqueda.toLowerCase().trim();
    if (search) {
      const searchDigits = search.replace(/\D/g, '');
      const telDigits = (c.telefono || c.external_id || '').replace(/\D/g, '');
      const matchPhoneDigits = searchDigits.length >= 3 && telDigits.includes(searchDigits);

      const matchNombre   = (c.nombre   || '').toLowerCase().includes(search);
      const matchUsername = (c.username || '').toLowerCase().includes(search);
      const matchTelefono = (c.telefono || c.external_id || '').toLowerCase().includes(search);
      const matchMensaje  = (c.ultimo_mensaje || '').toLowerCase().includes(search);
      const matchDepto    = (c.departamento || '').toLowerCase().includes(search);
      const matchAgente   = (c.agente_nombre || '').toLowerCase().includes(search);

      if (!matchNombre && !matchUsername && !matchTelefono && !matchPhoneDigits && !matchMensaje && !matchDepto && !matchAgente) {
        return false;
      }
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

  const handleConfirmarTransferencia = async (areaDestino, nota, agenteDestinoId, agenteDestinoNombre) => {
    if (!transferModalId) return;
    try {
      const idTransfer = transferModalId;
      setTransferModalId(null);
      setConversacionActiva(null);
      await apiService.transferirChat(idTransfer, areaDestino, nota, agenteDestinoId, agenteDestinoNombre);
    } catch (err) {
      alert(err.message || 'Error al transferir el chat');
    }
  };

  const handleEliminarChat = async (id) => {
    if (window.confirm('¿Eliminar permanentemente?')) await eliminarChat(id);
  };

  const handleEnviarMensaje = async (textoDirecto) => {
    const raw = typeof textoDirecto === 'string' ? textoDirecto : texto;
    if (!raw || !raw.trim()) return;
    const msg = raw.trim();
    if (typeof textoDirecto !== 'string') {
      setTexto('');
    }
    await enviarMensaje(msg);
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  if (!user) return <Login onLoginSuccess={login} />;
  if (user.debe_cambiar_password) {
    return (
      <CambiarPasswordPrimerLogin 
        user={user} 
        onSuccess={(updated) => actualizarUsuario(updated)} 
        onLogout={logout} 
      />
    );
  }
  if (user.rol === 'ti') return <TIPanel user={user} logout={logout} socket={socket} actualizarUsuario={actualizarUsuario} />;

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
        onLogout={() => setShowLogoutModal(true)}
        totalNoLeidos={totalNoLeidos}
        totalChatInterno={unreadChatInterno}
        totalInfracciones={totalInfracciones}
        hasModulo={hasModulo}
        esCoordinador={esCoordinador}
      />
      <div className="main-wrapper">
        <TopBar
          sidebarVisible={sidebarVisible}
          setSidebarVisible={setSidebarVisible}
          empresaId={empresaId}
          setEmpresaId={setEmpresaId}
          user={user}
          socket={socket}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          currentView={currentView}
          onLogout={() => setShowLogoutModal(true)}
          notificaciones={notificaciones}
          unreadCount={notifUnreadCount}
          onMarcarLeida={notifMarcarLeida}
          onMarcarTodasLeidas={notifMarcarTodasLeidas}
          onEliminarNotificacion={notifEliminar}
          onLimpiarTodas={notifLimpiarTodas}
          onSelectNotificacion={(notif) => {
            if (notif?.canalId) {
              setCanalInternoActivoId(notif.canalId);
            }
            setCurrentView('chat-interno');
          }}
        />
        <div className={`main-content${conversacionActiva ? ' has-active-chat' : ''}${chatDarkModeActivo ? ' chat-dark' : ''}${user && currentView !== 'chat-interno' && floatingChats && floatingChats.length > 0 ? ' has-floating-rail' : ''}`}>

          {currentView === 'chat' && (
            <>
              <ChatList
                conversaciones={conversacionesFiltradas}
                todasLasConversaciones={conversaciones}
                conversacionActiva={conversacionActiva}
                setConversacionActiva={setConversacionActiva}
                cargarMensajes={cargarMensajes}
                busqueda={busqueda}   setBusqueda={setBusqueda}
                filtro={filtro}       setFiltro={setFiltro}
                user={user}
                empresaId={empresaId}
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
            configLoading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                Cargando configuración...
              </div>
            ) : (
              <SettingsView
                config={config}
                setConfig={setConfig}
                empresaId={empresaId}
                user={user}
                esCoordinador={esCoordinador}
                onSave={async (clave, valor, area) => {
                  await apiService.updateConfig(clave, valor, empresaId, area);
                  await cargar();
                }}
              />
            )
          )}

          {currentView === 'dashboard' && (
            <DashboardView user={user} empresaId={empresaId} socket={socket} />
          )}

          {currentView === 'nps' && (
            <NpsDashboardView empresaId={empresaId} user={user} socket={socket} />
          )}

          {currentView === 'soluciones' && (
            <SolucionesStaffView empresaId={empresaId} user={user} socket={socket} />
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

          {currentView === 'equipos' && (
            <EquiposView empresaId={empresaId} user={user} />
          )}

          {currentView === 'comunicados' && (
            <MuralComunicadosView
              user={user}
              onAbrirChatDirecto={(contactoId) => {
                setCanalInternoActivoId(null);
                setCurrentView('chat-interno');
                // Disparar evento para abrir directo
                window.dispatchEvent(new CustomEvent('chat_interno:abrir_directo', { detail: { contactoId } }));
              }}
            />
          )}

          {currentView === 'chat-interno' && (
            <ChatInternoView socket={socket} user={user} darkMode={darkMode} canalInicialId={canalInternoActivoId} empresaId={empresaId} />
          )}

          {currentView === 'tickets' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', background: '#f8fafc', height: '100%', boxSizing: 'border-box' }}>
              <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                <TicketsView user={user} socket={socket} esModoGestionTI={false} />
              </div>
            </div>
          )}

          {!['chat','chat-interno','comunicados','agents','config','dashboard','nps','soluciones','contactos','infracciones','etiquetas','categorias-cierre','flow-editor','equipos','tickets'].includes(currentView) && (
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

      {/* Modal Visual de Confirmación de Cierre de Sesión */}
      <LogoutModal
        isOpen={showLogoutModal}
        user={user}
        onConfirm={() => {
          setShowLogoutModal(false);
          logout();
        }}
        onCancel={() => setShowLogoutModal(false)}
      />

      {/* Ventana Flotante Estilo Facebook Messenger */}
      {user && currentView !== 'chat-interno' && (
        <FloatingMessengerDock
          floatingChats={floatingChats}
          onAbrirChat={abrirFloatingChat}
          onMinimizeChat={minimizarFloatingChat}
          onCloseChat={cerrarFloatingChat}
          onExpandChat={(canalId) => {
            if (canalId) setCanalInternoActivoId(canalId);
            setCurrentView('chat-interno');
          }}
          miniChat={miniChat}
          onClose={cerrarMiniChat}
          onMinimize={minimizarMiniChat}
          onExpand={() => {
            cerrarMiniChat();
            setCurrentView('chat-interno');
          }}
          socket={socket}
          userActual={user}
        />
      )}
    </div>
  );
}

export default App;
