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
        await db.query('UPDATE conversaciones SET departamento = $1 WHERE id = $2', [depto, conversacion.id]);
        
        // ASIGNACIÓN INMEDIATA (Saltamos el paso de pedir datos)
        const agenteRes = await db.query(
          'SELECT id, nombre FROM agentes WHERE area = $1 AND esta_online = true LIMIT 1',
          [depto]
        );

        let agenteId = null;
        let agenteNombre = "un asesor";

        if (agenteRes.rows.length > 0) {
          agenteId = agenteRes.rows[0].id;
          agenteNombre = agenteRes.rows[0].nombre;
        }

        respuesta = `Entendido. Te estamos comunicando con el área de ${depto}. En un momento te atenderá ${agenteNombre}.`;
        
        await db.query(
          'UPDATE conversaciones SET es_humano = true, estado = $1, agente_id = $2 WHERE id = $3', 
          ['ESPERANDO_AGENTE', agenteId, conversacion.id]
        );

        const infoMsg = agenteId 
          ? `Chat ASIGNADO AUTOMÁTICAMENTE a: ${agenteNombre} (${depto})`
          : `Atención solicitada en ${depto}. No hay asesores online, el chat queda en espera general.`;
          
        await db.query('INSERT INTO mensajes (conversacion_id, texto, remitente) VALUES ($1, $2, $3)', 
          [conversacion.id, infoMsg, 'sistema_info']);

        nuevoEstado = 'ESPERANDO_AGENTE';
      } else {
        respuesta = 'Por favor, elija una opción válida:\n1. Ventas\n2. Cobranza\n3. Soporte';
      }
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