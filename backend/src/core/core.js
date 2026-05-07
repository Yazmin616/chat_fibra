/**
 * LÓGICA CENTRAL DEL BOT (MÁQUINA DE ESTADOS) - VERSIÓN PROFESIONAL
 */

const db = require('../config/db');
const {
  obtenerOcrearUsuario,
  obtenerOcrearConversacion,
  guardarMensaje,
  actualizarEstado
} = require('./conversaciones');

async function coreProcesar(input) {
  const usuario = await obtenerOcrearUsuario(input.canal, input.user_id, input.nombre, input.username);
  const conversacion = await obtenerOcrearConversacion(usuario.id, input.empresa_id || 'fibratec');

  await guardarMensaje(conversacion.id, 'user', input.mensaje);

  if (conversacion.es_humano) return null;

  let respuesta = "";
  let nuevoEstado = conversacion.estado;
  const mensaje = input.mensaje;

  try {
    /* ========================
       ESTADO: INICIO / SELECCIÓN DE EMPRESA
       ======================== */
    if (conversacion.estado === 'inicio' || conversacion.estado === 'abierta') {
      respuesta = `Bienvenido al sistema de atención. Por favor, seleccione la empresa con la que desea comunicarse:\n\n1. Fibratec\n2. Compusemmm de México`;
      nuevoEstado = 'SELECCION_EMPRESA';
    } 

    /* ========================
       ESTADO: PROCESAR EMPRESA
       ======================== */
    else if (conversacion.estado === 'SELECCION_EMPRESA') {
      let empresaElegida = "";
      let nombreEmpresa = "";

      if (mensaje.includes('1')) { empresaElegida = 'fibratec'; nombreEmpresa = "Fibratec"; }
      else if (mensaje.includes('2')) { empresaElegida = 'compusemmm'; nombreEmpresa = "Compusemmm de México"; }

      if (empresaElegida) {
        await db.query('UPDATE conversaciones SET empresa_id = $1 WHERE id = $2', [empresaElegida, conversacion.id]);
        respuesta = `Has seleccionado ${nombreEmpresa}. ¿En qué área podemos ayudarte?\n\n1. Ventas\n2. Cobranza\n3. Soporte Técnico`;
        nuevoEstado = 'SELECCION_AREA';
      } else {
        respuesta = 'Por favor, elija una opción válida:\n1. Fibratec\n2. Compusemmm';
      }
    }

    /* ========================
       ESTADO: SELECCIÓN DE ÁREA
       ======================== */
    else if (conversacion.estado === 'SELECCION_AREA') {
      let depto = "";
      if (mensaje.includes('1')) depto = "Ventas";
      else if (mensaje.includes('2')) depto = "Cobranza";
      else if (mensaje.includes('3')) depto = "Soporte Técnico";

      if (depto) {
        // 1. CERRAR la conversación de menú INMEDIATAMENTE (garantizado)
        await db.query(
          `UPDATE conversaciones SET estado = 'cerrada', updated_at = NOW() WHERE id = $1`,
          [conversacion.id]
        );

        // 2. CREAR conversación limpia para el área elegida
        const nuevaConvRes = await db.query(
          `INSERT INTO conversaciones (usuario_id, empresa_id, departamento, estado, es_humano, updated_at)
           VALUES ($1, $2, $3, 'ESPERANDO_AGENTE', true, NOW()) RETURNING id`,
          [conversacion.usuario_id, conversacion.empresa_id, depto]
        );
        const nuevaConvId = nuevaConvRes.rows[0].id;

        // 3. Banner informativo en la NUEVA conversación
        await db.query(
          `INSERT INTO mensajes (conversacion_id, texto, remitente) VALUES ($1, $2, $3)`,
          [nuevaConvId, `CLIENTE EN ESPERA DE ASESOR (${depto})`, 'sistema_info']
        );

        respuesta = `Entendido. Te estamos comunicando con el área de ${depto}. Un asesor te atenderá en breve.`;
        // Guardamos la respuesta en la nueva conversación, no en la de menú
        await db.query(
          `INSERT INTO mensajes (conversacion_id, texto, remitente) VALUES ($1, $2, $3)`,
          [nuevaConvId, respuesta, 'bot']
        );

        // Actualizamos el estado de la nueva conversación (ya está bien, pero por si acaso)
        nuevoEstado = 'ESPERANDO_AGENTE';
        // IMPORTANTE: evitamos que actualizarEstado se corra sobre la conv de menú al final
        return { texto: null, conversacion_id: nuevaConvId };
      } else {
        respuesta = 'Por favor, elija una opción válida:\n1. Ventas\n2. Cobranza\n3. Soporte';
      }
    }

    /* ========================
       ESTADO: ESPERANDO AGENTE
       (El cliente escribe mientras espera — no crear nueva conv)
       ======================== */
    else if (conversacion.estado === 'ESPERANDO_AGENTE') {
      respuesta = `Ya estás en la fila de espera. Un asesor de ${conversacion.departamento || 'nuestro equipo'} te atenderá en breve. Por favor, ten paciencia. 🙏`;
    }

    /* ========================
       ESTADO: ENCUESTAS (CSAT) - POCAS EMOJIS
       ======================== */
    else if (conversacion.estado === 'ENCUESTA_AGENTE' || conversacion.estado === 'ENCUESTA_BOT') {
      const tipo = conversacion.estado === 'ENCUESTA_AGENTE' ? 'agente' : 'bot';
      let puntuacion = 'Desconocida';
      if (mensaje.includes('1')) puntuacion = 'Mal';
      else if (mensaje.includes('2')) puntuacion = 'Regular';
      else if (mensaje.includes('3')) puntuacion = 'Bien';
      
      await db.query('INSERT INTO calificaciones (conversacion_id, puntuacion, sugerencia, tipo) VALUES ($1, $2, $3, $4)', [conversacion.id, puntuacion, mensaje, tipo]);
      
      // Notificar al dashboard en tiempo real
      if (global.io) {
        global.io.emit('nueva_calificacion', {
          conversacion_id: conversacion.id,
          empresa_id: conversacion.empresa_id,
          puntuacion
        });
      }

      respuesta = `Gracias por tu calificación. Que tengas un buen día.`;
      nuevoEstado = 'cerrada';
    }

  } catch (error) {
    console.error("[CORE ERROR]", error);
    respuesta = "Lo sentimos, hubo un error. Escriba 'hola' para reiniciar.";
    nuevoEstado = 'inicio';
  }

  await actualizarEstado(conversacion.id, nuevoEstado);
  if (respuesta) await guardarMensaje(conversacion.id, 'bot', respuesta);

  return { texto: respuesta, conversacion_id: conversacion.id };
}

module.exports = { coreProcesar };