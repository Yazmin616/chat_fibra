/**
 * APLICACIÓN PRINCIPAL (DASHBOARD)
 * Este archivo orquesta el estado global de la aplicación, la conexión de Sockets
 * y la renderización de las diferentes vistas (Chat, Configuración, etc.)
 */

import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { apiService } from "./services/api";

// Componentes Modularizados
import Sidebar from "./components/Layout/Sidebar";
import TopBar from "./components/Layout/TopBar";
import ChatList from "./components/Chat/ChatList";
import ChatWindow from "./components/Chat/ChatWindow";
import SettingsView from "./components/Settings/SettingsView";

// Conexión única de Socket.io
const socket = io(`http://${window.location.hostname}:3009`);

function App() {
  /* ========================
     ESTADOS DE LA UI
  ======================== */
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [currentView, setCurrentView] = useState('chat'); // 'chat' | 'config' | 'dashboard'
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

  // Carga inicial de datos
  useEffect(() => {
    fetchInitialData();
  }, []);

  /**
   * Obtiene la lista de chats y la configuración global al arrancar.
   */
  const fetchInitialData = async () => {
    try {
      const [convs, confs] = await Promise.all([
        apiService.getConversaciones(),
        apiService.getConfigs()
      ]);
      setConversaciones(convs);
      setConfig(confs);
    } catch (error) {
      console.error("Error cargando datos iniciales:", error);
    }
  };

  /**
   * Carga el historial de mensajes de un cliente específico.
   */
  const cargarMensajes = async (usuarioId) => {
    if (!usuarioId) return;
    try {
      const msgs = await apiService.getMensajes(usuarioId);
      setMensajes(msgs);
    } catch (error) {
      console.error("Error cargando mensajes:", error);
    }
  };

  /**
   * Envía un mensaje manual al cliente seleccionado.
   */
  const enviarMensaje = async () => {
    if (!texto || !conversacionActiva) return;
    const currentText = texto;
    setTexto(""); // Limpiar input inmediatamente (UI optimista)
    try {
      await apiService.responder(conversacionActiva.id, conversacionActiva.external_id, currentText);
    } catch (error) { console.error(error); }
  };

  /**
   * LÓGICA DE SOCKET.IO
   * Escucha eventos de 'nuevo_mensaje' para actualizar el chat en tiempo real.
   */
  useEffect(() => {
    const handleNuevoMensaje = (data) => {
      // Si el mensaje pertenece al chat que tengo abierto actualmente, lo añado a la lista
      if (conversacionActiva && Number(data.conversacion_id) === Number(conversacionActiva.id)) {
        setMensajes(prev => [...prev, { 
          remitente: data.remitente, 
          texto: data.mensaje, 
          created_at: new Date() 
        }]);
      }
      // Siempre refrescar la lista de conversaciones (por el último mensaje y orden)
      apiService.getConversaciones().then(setConversaciones);
    };

    socket.on('nuevo_mensaje', handleNuevoMensaje);
    return () => socket.off('nuevo_mensaje');
  }, [conversacionActiva]);

  // Scroll automático al final cuando llegan mensajes nuevos
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  /* ========================
     FILTRADO DE CHATS
  ======================== */
  const conversacionesFiltradas = conversaciones.filter(c => {
    const search = busqueda.toLowerCase();
    const matchBusqueda = (c.nombre || "").toLowerCase().includes(search) || (c.username || "").toLowerCase().includes(search);
    if (filtro === "Todos los chats") return matchBusqueda;
    if (filtro === "Abiertos") return matchBusqueda && c.estado !== 'cerrada';
    if (filtro === "Mis Asignados") return matchBusqueda && c.es_humano && c.estado !== 'cerrada';
    return matchBusqueda;
  });

  return (
    <div className="app-container">
      <Sidebar visible={sidebarVisible} currentView={currentView} setView={setCurrentView} />
      
      <div className="main-wrapper">
        <TopBar sidebarVisible={sidebarVisible} setSidebarVisible={setSidebarVisible} />
        
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
                     await apiService.cerrarChat(id, motivo, "Agente Fibratec");
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
                await apiService.updateConfig(clave, valor);
                alert("Configuración guardada");
              }} 
            />
          ) : (
            <div className="empty-chat"><div className="empty-content"><h2>Próximamente</h2></div></div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
