import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { apiService } from "./services/api";

// Componentes
import Sidebar from "./components/Layout/Sidebar";
import TopBar from "./components/Layout/TopBar";
import ChatList from "./components/Chat/ChatList";
import ChatWindow from "./components/Chat/ChatWindow";
import SettingsView from "./components/Settings/SettingsView";
import AgentManagementView from "./components/Settings/AgentManagementView";
import DashboardView from "./components/Settings/DashboardView";
import ContactsView from "./components/Contacts/ContactsView";
import Login from "./components/Auth/Login";

const socket = io(`http://${window.location.hostname}:3009`);

function App() {
  /* ========================
     ESTADO DE AUTENTICACIÓN
  ======================== */
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('agente_user');
    return saved ? JSON.parse(saved) : null;
  });

  /* ========================
     ESTADOS DE LA UI (CON PERSISTENCIA)
  ======================== */
  const [sidebarVisible, setSidebarVisible] = useState(true);
  
  const [currentView, setCurrentView] = useState(() => {
    return localStorage.getItem('app_current_view') || 'chat';
  });

  const [empresaId, setEmpresaId] = useState(() => {
    return localStorage.getItem('app_empresa_id') || 'fibratec';
  });

  const [config, setConfig] = useState({ tiempo_inactividad: 10 });
  
  /* ========================
     ESTADOS DEL CHAT
  ======================== */
  const [conversaciones, setConversaciones] = useState([]);
  const [conversacionActiva, setConversacionActiva] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [filtro, setFiltro] = useState("Todos los chats"); // Por defecto a Bandeja de Entrada
  const [busqueda, setBusqueda] = useState("");
  const messagesEndRef = useRef(null);

  // Guardar persistencia en localStorage
  useEffect(() => {
    localStorage.setItem('app_current_view', currentView);
  }, [currentView]);

  useEffect(() => {
    localStorage.setItem('app_empresa_id', empresaId);
  }, [empresaId]);

  // Cargar datos cuando cambia empresa o usuario
  useEffect(() => {
    if (user) {
      fetchInitialData();
    }
  }, [empresaId, user]);

  const fetchInitialData = async () => {
    try {
      const [convs, confs] = await Promise.all([
        apiService.getConversaciones(empresaId, user?.id),
        apiService.getConfigs(empresaId)
      ]);
      setConversaciones(convs);
      setConfig(confs);
    } catch (error) { console.error(error); }
  };

  const cargarMensajes = async (usuarioId, conversacionId) => {
    if (!usuarioId || !user) return;
    // Admin: sin conversacion_id → ve historial completo unificado del usuario
    // Asesor: con conversacion_id → ve solo los mensajes de su conversación específica
    const convIdParam = user?.rol === 'admin' ? undefined : conversacionId;
    const msgs = await apiService.getMensajes(usuarioId, user.id, convIdParam);
    setMensajes(msgs);
    // Marcar como leído al entrar
    if (conversacionId) {
      await apiService.marcarLeido(conversacionId);
      apiService.getConversaciones(empresaId, user?.id).then(setConversaciones);
    }
  };

  const enviarMensaje = async () => {
    if (!texto || !conversacionActiva) return;
    const currentText = texto;
    setTexto("");
    await apiService.responder(conversacionActiva.id, conversacionActiva.external_id, currentText, user.id);
  };

  const handleLoginSuccess = (data) => {
    setUser(data.agente);
    localStorage.setItem('agente_user', JSON.stringify(data.agente));
    localStorage.setItem('agente_token', data.token);
  };

  const handleLogout = async () => {
    if (user) await apiService.logout(user.id);
    setUser(null);
    localStorage.clear(); // Limpiar todo al salir
  };

  useEffect(() => {
    const handleNuevoMensaje = (data) => {
      // 1. Si es de la empresa actual, incrementar el contador localmente (sin refetch)
      if (data.empresa_id === empresaId) {
        setConversaciones(prev => prev.map(c => {
          const esAdmin = user?.rol === 'admin';
          const match = esAdmin
            ? Number(c.usuario_id) === Number(data.usuario_id)
            : Number(c.id) === Number(data.conversacion_id);

          if (match && data.remitente === 'user') {
            // Si el chat está abierto, NO incrementar (se marca leído al instante)
            const esChatActivo = conversacionActiva && (
              esAdmin
                ? Number(conversacionActiva.usuario_id) === Number(data.usuario_id)
                : Number(conversacionActiva.id) === Number(data.conversacion_id)
            );
            if (esChatActivo) return c; // ya está abierto, no sumar
            return { ...c, no_leidos: String(parseInt(c.no_leidos || 0) + 1) };
          }
          return c;
        }));
      }

      // 2. Si el chat está abierto, añadir el mensaje a la ventana
      const esAdmin = user?.rol === 'admin';
      const esMismoChat = Number(data.conversacion_id) === Number(conversacionActiva?.id);
      const esMismoUsuario = data.usuario_id && Number(data.usuario_id) === Number(conversacionActiva?.usuario_id);

      if (conversacionActiva && (esAdmin ? esMismoUsuario : esMismoChat)) {
        setMensajes(prev => [...prev, { 
          remitente: data.remitente, 
          texto: data.mensaje, 
          created_at: data.fecha || new Date() 
        }]);
        // 3. Marcar como leído automáticamente si el chat está abierto
        if (data.remitente === 'user') {
          apiService.marcarLeido(conversacionActiva.id);
        }
      }
    };

    const handleLectura = (data) => {
      // Actualización directa del estado local → sin refetch, instantáneo en todos los paneles
      // Pone en 0 el contador de la conversación leída (por conversacion_id O por usuario_id para el Admin)
      setConversaciones(prev => prev.map(c => {
        const mismoPorId = Number(c.id) === Number(data.conversacion_id);
        const mismoPorUsuario = data.usuario_id && Number(c.usuario_id) === Number(data.usuario_id);
        if (mismoPorId || mismoPorUsuario) {
          return { ...c, no_leidos: '0' };
        }
        return c;
      }));
    };

    const handleActualizacion = (data) => {
      if (data.empresa_id === empresaId) {
        apiService.getConversaciones(empresaId, user?.id).then(setConversaciones);
      }
    };

    const handleEliminacion = (data) => {
      // Refresh listado
      apiService.getConversaciones(empresaId, user?.id).then(setConversaciones);
      
      // Si el chat eliminado es el que tengo abierto, o pertenece al mismo usuario que borramos, cerrarlo
      const esMismoChat = conversacionActiva && Number(data.id) === Number(conversacionActiva.id);
      const esMismoUsuario = conversacionActiva && data.usuarioId && Number(data.usuarioId) === Number(conversacionActiva.usuario_id);

      if (esMismoChat || esMismoUsuario) {
        setConversacionActiva(null);
        setMensajes([]);
      }
    };

    socket.on('nuevo_mensaje', handleNuevoMensaje);
    socket.on('conversacion_leida', handleLectura);
    socket.on('conversacion_actualizada', handleActualizacion);
    socket.on('conversacion_eliminada', handleEliminacion);

    return () => {
      socket.off('nuevo_mensaje');
      socket.off('conversacion_leida');
      socket.off('conversacion_actualizada');
      socket.off('conversacion_eliminada');
    };
  }, [conversacionActiva, empresaId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        setConversacionActiva(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [setConversacionActiva]);

  // =============================================
  // LÓGICA DE FILTRADO DEL PANEL
  // =============================================
  const conversacionesFiltradas = conversaciones.filter(c => {
    const search = busqueda.toLowerCase();
    const matchBusqueda = (c.nombre || "").toLowerCase().includes(search) || 
                          (c.username || "").toLowerCase().includes(search);

    // Estados puramente del bot (el cliente aún no eligió área) — no se muestran a nadie en la bandeja
    const estadosPuroBot = ['abierta', 'MENU_PRINCIPAL', 'SELECCION_EMPRESA', 'SELECCION_AREA'];
    const esPuroBot = estadosPuroBot.includes(c.estado);

    if (!matchBusqueda) return false;

    if (filtro === "Todos los chats") {
      if (user?.rol === 'admin') {
        // ADMIN: Ve TODO excepto chats en selección de menú (solo bot hablando)
        return !esPuroBot;
      } else {
        // ASESOR: Ve los chats de su área que están EN ESPERA (sin agente asignado) o ya cerrados
        const sinAgente = !c.agente_id;
        const estaCerrado = c.estado === 'cerrada' || c.estado?.startsWith('ENCUESTA');
        return sinAgente || estaCerrado;
      }
    }

    if (filtro === "Mis Asignados") {
      // Solo los chats que YO tengo asignados y que NO están cerrados
      return Number(c.agente_id) === Number(user?.id) && c.estado !== 'cerrada' && !c.estado?.startsWith('ENCUESTA');
    }

    return false;
  });

  if (!user) return <Login onLoginSuccess={handleLoginSuccess} />;

  return (
    <div className="app-container">
      <Sidebar visible={sidebarVisible} currentView={currentView} setView={setCurrentView} user={user} onLogout={handleLogout} />
      <div className="main-wrapper">
        <TopBar 
          sidebarVisible={sidebarVisible} 
          setSidebarVisible={setSidebarVisible} 
          empresaId={empresaId} 
          setEmpresaId={setEmpresaId}
          user={user}
        />
        <div className="main-content">
          {currentView === 'chat' ? (
            <>
              <ChatList 
                conversaciones={conversacionesFiltradas} 
                conversacionActiva={conversacionActiva} 
                setConversacionActiva={setConversacionActiva} 
                cargarMensajes={cargarMensajes} 
                busqueda={busqueda} setBusqueda={setBusqueda} 
                filtro={filtro} setFiltro={setFiltro} 
                user={user}
              />
              <ChatWindow 
                conversacionActiva={conversacionActiva} 
                mensajes={mensajes} 
                texto={texto} setTexto={setTexto} 
                enviarMensaje={enviarMensaje} 
                cerrarConversacion={async (id) => {
                   const motivo = window.prompt("Motivo del cierre:", "cliente solucionado");
                   if (motivo) {
                     await apiService.cerrarChat(id, motivo, user.nombre);
                     fetchInitialData();
                   }
                }} 
                eliminarConversacion={async (id) => {
                  if (window.confirm("¿Eliminar permanentemente?")) {
                    await apiService.eliminarChat(id);
                    setConversacionActiva(null);
                    setMensajes([]);
                    fetchInitialData();
                  }
                }} 
                messagesEndRef={messagesEndRef} 
                setConversacionActiva={setConversacionActiva}
              />
            </>
          ) : currentView === 'agents' ? (
            <AgentManagementView />
          ) : currentView === 'config' ? (
            <SettingsView 
              config={config} 
              setConfig={setConfig} 
              onSave={async (clave, valor) => {
                await apiService.updateConfig(clave, valor, empresaId);
                alert(`Configuración guardada para ${empresaId}`);
              }} 
            />
          ) : currentView === 'dashboard' ? (
            <DashboardView user={user} empresaId={empresaId} socket={socket} />
          ) : currentView === 'contactos' ? (
            <ContactsView />
          ) : (
            <div className="empty-chat"><div className="empty-content"><h2>Próximamente</h2></div></div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
