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
     ESTADOS DE LA UI
  ======================== */
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [currentView, setCurrentView] = useState('chat');
  const [empresaId, setEmpresaId] = useState('fibratec');
  const [config, setConfig] = useState({ tiempo_inactividad: 10 });
  
  /* ========================
     ESTADOS DEL CHAT
  ======================== */
  const [conversaciones, setConversaciones] = useState([]);
  const [conversacionActiva, setConversacionActiva] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [filtro, setFiltro] = useState("Abiertos");
  const [busqueda, setBusqueda] = useState("");
  const messagesEndRef = useRef(null);

  // Cargar datos cuando cambia empresa o usuario
  useEffect(() => {
    if (user) {
      fetchInitialData();
      setConversacionActiva(null);
      setMensajes([]);
    }
  }, [empresaId, user]);

  const fetchInitialData = async () => {
    try {
      const [convs, confs] = await Promise.all([
        apiService.getConversaciones(empresaId),
        apiService.getConfigs(empresaId)
      ]);
      setConversaciones(convs);
      setConfig(confs);
    } catch (error) { console.error(error); }
  };

  const cargarMensajes = async (usuarioId) => {
    if (!usuarioId) return;
    const msgs = await apiService.getMensajes(usuarioId);
    setMensajes(msgs);
  };

  const enviarMensaje = async () => {
    if (!texto || !conversacionActiva) return;
    const currentText = texto;
    setTexto("");
    await apiService.responder(conversacionActiva.id, conversacionActiva.external_id, currentText);
  };

  const handleLoginSuccess = (data) => {
    setUser(data.agente);
    localStorage.setItem('agente_user', JSON.stringify(data.agente));
    localStorage.setItem('agente_token', data.token);
  };

  const handleLogout = async () => {
    if (user) {
      await apiService.logout(user.id);
    }
    setUser(null);
    localStorage.removeItem('agente_user');
    localStorage.removeItem('agente_token');
  };

  useEffect(() => {
    const handleNuevoMensaje = (data) => {
      if (conversacionActiva && Number(data.conversacion_id) === Number(conversacionActiva.id)) {
        setMensajes(prev => [...prev, { remitente: data.remitente, texto: data.mensaje, created_at: new Date() }]);
      }
      apiService.getConversaciones(empresaId).then(setConversaciones);
    };
    socket.on('nuevo_mensaje', handleNuevoMensaje);
    return () => socket.off('nuevo_mensaje');
  }, [conversacionActiva, empresaId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  // FILTRADO POR ROL Y AREA
  const conversacionesFiltradas = conversaciones.filter(c => {
    const search = busqueda.toLowerCase();
    const matchBusqueda = (c.nombre || "").toLowerCase().includes(search) || (c.username || "").toLowerCase().includes(search);
    
    // Si el filtro es "Todos los chats", aplicamos las reglas de visibilidad por Rol y Área
    if (filtro === "Todos los chats") {
      if (user?.rol === 'admin') {
        // El ADMIN ve: Sin asignar OR Cerrados OR En Encuesta (para supervisar)
        const esVisibleParaAdmin = c.agente_id === null || c.estado === 'cerrada' || c.estado.startsWith('ENCUESTA');
        return matchBusqueda && esVisibleParaAdmin;
      } else {
        // El ASESOR ve: Sin asignar OR Cerrados, pero SOLO de su Área
        const esVisibleParaAsesor = c.agente_id === null || c.estado === 'cerrada';
        const esDeSuArea = c.departamento === user?.area;
        return matchBusqueda && esVisibleParaAsesor && esDeSuArea;
      }
    }

    // Si el filtro es "Abiertos", mostrar todo lo que no esté cerrado (Vista de Supervisor)
    if (filtro === "Abiertos") {
      return matchBusqueda && c.estado !== 'cerrada';
    }

    // Si el filtro es "Mis Asignados", mostrar solo lo del usuario actual
    if (filtro === "Mis Asignados") {
      return matchBusqueda && Number(c.agente_id) === Number(user?.id) && c.estado !== 'cerrada';
    }

    return matchBusqueda;
  });

  // SI NO HAY USUARIO, MOSTRAR LOGIN
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

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
              />
            </>
          ) : currentView === 'config' ? (
            <SettingsView 
              config={config} 
              setConfig={setConfig} 
              onSave={async (clave, valor) => {
                await apiService.updateConfig(clave, valor, empresaId);
                alert(`Configuración guardada para ${empresaId}`);
              }} 
            />
          ) : currentView === 'agents' ? (
            <AgentManagementView />
          ) : (
            <div className="empty-chat"><div className="empty-content"><h2>Próximamente</h2></div></div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
