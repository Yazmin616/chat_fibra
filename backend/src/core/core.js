/**
 * LÓGICA CENTRAL DEL BOT (MÁQUINA DE ESTADOS)
 * Este archivo procesa cada mensaje entrante y decide qué responder 
 * y a qué estado mover la conversación.
 */

const db = require('../config/db');
const {
  obtenerOcrearUsuario,
  obtenerOcrearConversacion,
  guardarMensaje,
  actualizarEstado,
  actualizarContexto
} = require('./conversaciones');

/**
 * Procesa un mensaje entrante de cualquier canal (Telegram, WhatsApp, etc.)
 * @param {Object} input - Objeto con datos del mensaje {canal, user_id, nombre, username, mensaje}
 * @returns {Object} - La respuesta generada y el ID de la conversación
 */
async function coreProcesar(input) {

  // 1. Identificar o crear al usuario en la base de datos
  const usuario = await obtenerOcrearUsuario(
    input.canal,
    input.user_id,
    input.nombre,
    input.username
  );

  // 2. Buscar si tiene una conversación abierta o crear una nueva
  const conversacion = await obtenerOcrearConversacion(usuario.id, input.empresa_id);

  let contexto = conversacion.contexto || {};

  // 3. Registrar el mensaje del usuario en el historial
  await guardarMensaje(conversacion.id, 'user', input.mensaje);

  /**
   * MODO HUMANO: Si la conversación está marcada como es_humano = true,
   * el bot se queda en silencio y no procesa lógica, permitiendo que un agente responda.
   */
  if (conversacion.es_humano) {
    return null;
  }

  /* ========================
     FLUJO DEL BOT (FSM)
  ======================== */
  let respuesta = "";
  let nuevoEstado = conversacion.estado;
  const mensaje = input.mensaje;

  try {
    // ESTADO INICIAL: Primera vez que escribe o después de cerrar
    if (conversacion.estado === 'inicio') {
      respuesta = `¡Bienvenido al Menú de opciones! 🏢 Estamos aquí para ayudarte a todo lo relacionado con nuestros servicios. 🌐 Por favor elige una de las opciones a continuación ⬇️ para que podamos brindarte la información que necesitas\n\n1️⃣ Soy cliente 👤\n2️⃣ No soy cliente 🆕\n3️⃣ Hablar con un asesor 👨‍💻`;
      nuevoEstado = 'MENU_PRINCIPAL';
    } 
    // MENU PRINCIPAL: El usuario elige una opción
    else if (conversacion.estado === 'MENU_PRINCIPAL') {
      if (mensaje.includes('1')) {
        respuesta = 'Selecciona la opción que desees conveniente para identificarte.\n\n📱 Teléfono\n📧 Email';
        nuevoEstado = 'IDENTIFICACION';
      } 
      // PASAR A ASESOR: Desactiva el bot para esta conversación
      else if (mensaje.includes('3') || mensaje.toLowerCase().includes('asesor')) {
        respuesta = 'Gracias por comunicarse, en un momento un asesor se comunicará contigo. Espere por favor.';
        
        // Marcar conversación para humano
        await db.query('UPDATE conversaciones SET es_humano = true, estado = $1 WHERE id = $2', ['ESPERANDO_AGENTE', conversacion.id]);
        
        // Banner informativo en el dashboard
        await db.query('INSERT INTO mensajes (conversacion_id, texto, remitente) VALUES ($1, $2, $3)', 
          [conversacion.id, 'Se desactivo el bot, el contacto solicita continuar con un asesor', 'sistema_info']);
        
        nuevoEstado = 'ESPERANDO_AGENTE';
      } else {
        respuesta = 'Por favor, elige una opción válida (1, 2 o 3).';
      }
    }
    // IDENTIFICACIÓN: Pidiendo datos al cliente
    else if (conversacion.estado === 'IDENTIFICACION') {
      respuesta = 'Por favor envía tu identificación (Teléfono o Email) para continuar.';
      nuevoEstado = 'ESPERANDO_DATOS';
    }
    // SISTEMA DE ENCUESTAS (CSAT): Captura calificación para Bot o Agente
    else if (conversacion.estado === 'ENCUESTA_AGENTE' || conversacion.estado === 'ENCUESTA_BOT') {
      const tipo = conversacion.estado === 'ENCUESTA_AGENTE' ? 'agente' : 'bot';
      let puntuacion = 'Desconocida';
      
      // Mapeo simple de números a texto de calificación
      if (mensaje.includes('1')) puntuacion = 'Mal';
      else if (mensaje.includes('2')) puntuacion = 'Regular';
      else if (mensaje.includes('3')) puntuacion = 'Bien';
      
      // Guardar en la tabla de calificaciones para analítica
      await db.query('INSERT INTO calificaciones (conversacion_id, puntuacion, sugerencia, tipo) VALUES ($1, $2, $3, $4)', 
        [conversacion.id, puntuacion, mensaje, tipo]);
      
      respuesta = `Se ha calificado la conversación como: ${puntuacion === 'Bien' ? '🤩 Bien' : puntuacion === 'Regular' ? '😐 Regular' : '☹️ Mal'}\n\nMuchas gracias por tu calificación. ¡Que tengas un excelente día! 😊`;
      nuevoEstado = 'cerrada';
    } else {
      // Fallback por si el estado se corrompe
      respuesta = `¡Bienvenido! Escribe 'hola' para ver el menú.`;
      nuevoEstado = 'inicio';
    }

  } catch (error) {
    console.error("[CORE ERROR]", error);
    respuesta = "Lo siento, tuve un error interno. Intenta de nuevo.";
    nuevoEstado = 'inicio';
  }

  // Persistir el nuevo estado y el mensaje del bot
  await actualizarEstado(conversacion.id, nuevoEstado);
  if (respuesta) {
    await guardarMensaje(conversacion.id, 'bot', respuesta);
  }

  return {
    texto: respuesta,
    conversacion_id: conversacion.id
  };
}

module.exports = { coreProcesar };