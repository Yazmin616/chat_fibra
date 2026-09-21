import React, { useState, useEffect } from 'react';
import { useChatInterno } from '../../hooks/useChatInterno';
import { useChatTheme } from '../../hooks/useChatTheme';
import ChatInternoSidebar from './ChatInternoSidebar';
import ChatInternoWindow from './ChatInternoWindow';
import ChatInternoDetailsPanel from './ChatInternoDetailsPanel';

const ChatInternoView = ({ socket, user, darkMode, canalInicialId, empresaId }) => {
  const [modalCrearOpen, setModalCrearOpen] = useState(false);
  const [detallesOpen, setDetallesOpen] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1350);

  // Hook modular de gestión de tema (claro / oscuro) sincronizado con localStorage y eventos globales
  const { isDark, toggleTheme } = useChatTheme(darkMode);

  const {
    canales,
    contactos,
    canalActivo,
    mensajes,
    cargandoMensajes,
    escribiendoMap,
    seleccionarCanal,
    deseleccionarCanal,
    abrirChatDirecto,
    crearCanal,
    eliminarCanal,
    ocultarConversacion,
    toggleFijarCanal,
    enviarTexto,
    enviarAdjunto,
    enviarSticker,
    editarMensaje,
    toggleFijarMensaje,
    eliminarMensaje,
    toggleDestacarMensaje,
    toggleReaccion,
    emitTyping,
  } = useChatInterno({ socket, user, canalInicialId });

  useEffect(() => {
    if (canalInicialId) {
      seleccionarCanal(canalInicialId);
    }
  }, [canalInicialId, seleccionarCanal]);

  // Abrir canal automáticamente al hacer clic en notificación de escritorio
  useEffect(() => {
    const handleAbrirCanal = (e) => {
      const cid = e.detail?.canalId;
      if (cid) {
        seleccionarCanal(cid);
      }
    };
    window.addEventListener('sistema:abrir_canal_interno', handleAbrirCanal);
    return () => window.removeEventListener('sistema:abrir_canal_interno', handleAbrirCanal);
  }, [seleccionarCanal]);

  // Notificar al centro de notificaciones cuál canal está actualmente abierto en pantalla
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('chat_interno:canal_activo_changed', {
      detail: { canalId: canalActivo?.id || null }
    }));
    return () => {
      window.dispatchEvent(new CustomEvent('chat_interno:canal_activo_changed', {
        detail: { canalId: null }
      }));
    };
  }, [canalActivo?.id]);

  return (
    <div className={`chat-interno-container ${isDark ? 'chat-dark' : ''}`}>
      {/* Columna 1: Canales y Mensajes Directos */}
      <ChatInternoSidebar
        canales={canales}
        contactos={contactos}
        canalActivo={canalActivo}
        mensajesActivos={mensajes}
        escribiendoMap={escribiendoMap}
        onSeleccionarCanal={seleccionarCanal}
        onAbrirDirecto={abrirChatDirecto}
        onAbrirModalCrearCanal={() => setModalCrearOpen(true)}
        onToggleFijar={toggleFijarCanal}
        userActual={user}
        empresaId={empresaId}
        crearGrupoOpen={modalCrearOpen}
        onCloseCrearGrupo={() => setModalCrearOpen(false)}
        onCrearGrupo={crearCanal}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />

      {/* Columna 2: Ventana de Conversación */}
      <ChatInternoWindow
        canalActivo={canalActivo}
        mensajes={mensajes}
        cargandoMensajes={cargandoMensajes}
        escribiendoMap={escribiendoMap}
        onEnviarTexto={enviarTexto}
        onEnviarAdjunto={enviarAdjunto}
        onEnviarSticker={enviarSticker}
        onEditarMensaje={editarMensaje}
        onToggleFijarMensaje={toggleFijarMensaje}
        onEliminarMensaje={eliminarMensaje}
        onToggleDestacarMensaje={toggleDestacarMensaje}
        onDeseleccionarCanal={deseleccionarCanal}
        onTyping={emitTyping}
        onToggleReaccion={toggleReaccion}
        onToggleDetalles={() => setDetallesOpen(prev => !prev)}
        onToggleFijar={toggleFijarCanal}
        detallesOpen={detallesOpen}
        userActual={user}
        contactos={contactos}
        onAbrirModalCrearCanal={() => setModalCrearOpen(true)}
      />

      {/* Columna 3: Panel de Información, Miembros y Archivos Compartidos (Slack/Teams) */}
      {detallesOpen && canalActivo && (
        <ChatInternoDetailsPanel
          canal={canalActivo}
          contactos={contactos}
          onClose={() => setDetallesOpen(false)}
          userActual={user}
          onEliminarCanal={eliminarCanal}
          onOcultarConversacion={ocultarConversacion}
        />
      )}
    </div>
  );
};

export default ChatInternoView;
