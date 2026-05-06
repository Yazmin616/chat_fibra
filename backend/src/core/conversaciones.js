const db = require('../config/db');

async function obtenerOcrearUsuario(canal, external_id, nombre = "", username = "") {
  const res = await db.query(
    'SELECT * FROM usuarios WHERE canal=$1 AND external_id=$2',
    [canal, external_id]
  );

  if (res.rows.length > 0) {
    // actualizar datos si cambiaron
    await db.query(
      'UPDATE usuarios SET nombre=$1, username=$2 WHERE id=$3',
      [nombre, username, res.rows[0].id]
    );

    return res.rows[0];
  }

  const nuevo = await db.query(
    'INSERT INTO usuarios (canal, external_id, nombre, username) VALUES ($1, $2, $3, $4) RETURNING *',
    [canal, external_id, nombre, username]
  );

  return nuevo.rows[0];
}

async function obtenerOcrearConversacion(usuario_id, empresa_id) {
  const res = await db.query(
    'SELECT * FROM conversaciones WHERE usuario_id=$1 AND estado != $2',
    [usuario_id, 'cerrada']
  );

  if (res.rows.length > 0) return res.rows[0];

  const nuevo = await db.query(
    'INSERT INTO conversaciones (usuario_id, empresa_id, estado, es_humano) VALUES ($1, $2, $3, $4) RETURNING *',
    [usuario_id, empresa_id, 'abierta', false]
  );

  return nuevo.rows[0];
}

async function guardarMensaje(conversacion_id, remitente, texto) {
  // 1. Guardar el mensaje
  await db.query(
    'INSERT INTO mensajes (conversacion_id, remitente, texto) VALUES ($1, $2, $3)',
    [conversacion_id, remitente, texto]
  );
  // 2. Actualizar la fecha de actividad de la conversación
  await db.query(
    'UPDATE conversaciones SET updated_at = NOW() WHERE id = $1',
    [conversacion_id]
  );
}

async function actualizarEstado(conversacion_id, estado) {
  await db.query(
    'UPDATE conversaciones SET estado=$1, updated_at = NOW() WHERE id=$2',
    [estado, conversacion_id]
  );
}

async function actualizarContexto(conversacion_id, contexto) {
  await db.query(
    'UPDATE conversaciones SET contexto=$1 WHERE id=$2',
    [contexto, conversacion_id]
  );
}

module.exports = {
  obtenerOcrearUsuario,
  obtenerOcrearConversacion,
  guardarMensaje,
  actualizarEstado,
  actualizarContexto
};