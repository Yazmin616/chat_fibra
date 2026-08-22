import React, { useState, useEffect } from 'react';
import { useChatInterno } from '../../hooks/useChatInterno';
import ChatInternoSidebar from './ChatInternoSidebar';
import ChatInternoWindow from './ChatInternoWindow';
import ChatInternoDetailsPanel from './ChatInternoDetailsPanel';
import CrearCanalModal from './CrearCanalModal';

const ChatInternoView = ({ socket, user, darkMode, canalInicialId }) => {
  const [modalCrearOpen, setModalCrearOpen] = useState(false);
  const [detallesOpen, setDetallesOpen] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1350);

  const {
    canales,
    contactos,
    canalActivo,
    mensajes,
    cargandoMensajes,
    escribiendoMap,
    seleccionarCanal,
    abrirChatDirecto,
    crearCanal,
    eliminarCanal,
    ocultarConversacion,
    enviarTexto,
    enviarAdjunto,
    toggleReaccion,
    emitTyping,
  } = useChatInterno({ socket, user, canalInicialId });

  useEffect(() => {
    if (canalInicialId) {
      seleccionarCanal(canalInicialId);
    }
  }, [canalInicialId, seleccionarCanal]);

  return (
    <div className={`chat-interno-container ${darkMode ? 'chat-dark' : ''}`}>
      {/* Columna 1: Canales y Mensajes Directos */}
      <ChatInternoSidebar
        canales={canales}
        contactos={contactos}
        canalActivo={canalActivo}
        onSeleccionarCanal={seleccionarCanal}
        onAbrirDirecto={abrirChatDirecto}
        onAbrirModalCrearCanal={() => setModalCrearOpen(true)}
        userActual={user}
      />

      {/* Columna 2: Ventana de Conversación */}
      <ChatInternoWindow
        canalActivo={canalActivo}
        mensajes={mensajes}
        cargandoMensajes={cargandoMensajes}
        escribiendoMap={escribiendoMap}
        onEnviarTexto={enviarTexto}
        onEnviarAdjunto={enviarAdjunto}
        onTyping={emitTyping}
        onToggleReaccion={toggleReaccion}
        onToggleDetalles={() => setDetallesOpen(prev => !prev)}
        detallesOpen={detallesOpen}
        userActual={user}
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

      {/* Modal para Crear Canal */}
      {modalCrearOpen && (
        <CrearCanalModal
          contactos={contactos}
          onCrear={crearCanal}
          onClose={() => setModalCrearOpen(false)}
        />
      )}
    </div>
  );
};

export default ChatInternoView;
