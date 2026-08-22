/**
 * @file chatInterno.repository.js
 * @description Acceso a datos para el Módulo de Chat Interno Corporativo.
 * Soporta canales públicos/privados, solo lectura, reacciones con emojis,
 * retención de historial para miembros removidos y gestión de participantes.
 */

const db = require('../config/db');

/**
 * Obtiene todos los canales y chats directos en los que participa un agente
 * (incluyendo canales donde fue removido pero conserva historial).
 */
async function getCanalesByAgente(agenteId) {
  const query = `
    SELECT 
      c.id,
      c.nombre,
      c.descripcion,
      c.tipo,
      c.es_privado,
      c.solo_lectura,
      c.creador_id,
      c.created_at,
      c.eliminado AS canal_eliminado,
      c.eliminado_en,
      COALESCE(m_me.activo, TRUE) AS soy_miembro_activo,
      m_me.salido_en,
      CASE 
        WHEN c.tipo = 'directo' THEN (
          SELECT json_build_object(
            'id', a.id,
            'nombre', a.nombre,
            'email', a.email,
            'foto_perfil', a.foto_perfil,
            'rol', a.rol,
            'area', a.area,
            'esta_online', a.esta_online,
            'estado_presencia', COALESCE(a.estado_presencia, 'disponible'),
            'mensaje_presencia', a.mensaje_presencia,
            'last_seen', a.last_seen
          )
          FROM chat_interno_miembros m2
          JOIN agentes a ON a.id = m2.agente_id
          WHERE m2.canal_id = c.id AND m2.agente_id != $1
          LIMIT 1
        )
        ELSE NULL
      END AS otro_participante,
      (
        SELECT json_build_object(
          'id', m.id,
          'mensaje', m.mensaje,
          'tipo', m.tipo,
          'emisor_id', m.emisor_id,
          'emisor_nombre', a_emisor.nombre,
          'created_at', m.created_at
        )
        FROM chat_interno_mensajes m
        JOIN agentes a_emisor ON a_emisor.id = m.emisor_id
        WHERE m.canal_id = c.id
          AND (m_me.activo IS NOT FALSE OR m_me.salido_en IS NULL OR m.created_at <= m_me.salido_en)
        ORDER BY m.id DESC
        LIMIT 1
      ) AS ultimo_mensaje,
      (
        SELECT COUNT(*)::int
        FROM chat_interno_mensajes msg
        WHERE msg.canal_id = c.id
          AND msg.emisor_id != $1
          AND (m_me.activo IS NOT FALSE OR m_me.salido_en IS NULL OR msg.created_at <= m_me.salido_en)
          AND msg.created_at >= COALESCE(m_me.unido_en, (SELECT created_at FROM agentes WHERE id = $1), NOW())
          AND msg.id > COALESCE(
            (SELECT l.ultimo_mensaje_leido_id FROM chat_interno_leidos l WHERE l.canal_id = c.id AND l.agente_id = $1),
            0
          )
      ) AS unread_count
    FROM chat_interno_canales c
    LEFT JOIN chat_interno_miembros m_me ON m_me.canal_id = c.id AND m_me.agente_id = $1
    WHERE 
      COALESCE(m_me.oculto, FALSE) = FALSE
      AND (
        (c.tipo = 'canal' AND c.es_privado = FALSE AND COALESCE(c.eliminado, FALSE) = FALSE)
        OR (m_me.agente_id IS NOT NULL)
      )
    ORDER BY 
      COALESCE(
        (SELECT MAX(created_at) FROM chat_interno_mensajes WHERE canal_id = c.id),
        c.created_at
      ) DESC
  `;
  const { rows } = await db.query(query, [agenteId]);
  return rows;
}

/**
 * Busca un canal directo existente entre dos agentes.
 */
async function findDirectChannel(agente1Id, agente2Id) {
  const query = `
    SELECT c.id, c.tipo, c.solo_lectura, c.created_at
    FROM chat_interno_canales c
    JOIN chat_interno_miembros m1 ON m1.canal_id = c.id AND m1.agente_id = $1
    JOIN chat_interno_miembros m2 ON m2.canal_id = c.id AND m2.agente_id = $2
    WHERE c.tipo = 'directo'
    LIMIT 1
  `;
  const { rows } = await db.query(query, [agente1Id, agente2Id]);
  return rows[0] || null;
}

/**
 * Crea un chat directo entre dos agentes.
 */
async function createDirectChannel(agente1Id, agente2Id) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO chat_interno_canales(tipo, es_privado, solo_lectura, creador_id)
       VALUES ('directo', TRUE, FALSE, $1)
       RETURNING *`,
      [agente1Id]
    );
    const canal = rows[0];

    await client.query(
      `INSERT INTO chat_interno_miembros(canal_id, agente_id, activo)
       VALUES ($1, $2, TRUE), ($1, $3, TRUE)
       ON CONFLICT DO NOTHING`,
      [canal.id, agente1Id, agente2Id]
    );

    await client.query('COMMIT');
    return canal;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Crea un nuevo canal grupal.
 */
async function createCanal(nombre, descripcion, esPrivado, soloLectura, creadorId, miembroIds = []) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO chat_interno_canales(nombre, descripcion, tipo, es_privado, solo_lectura, creador_id)
       VALUES ($1, $2, 'canal', $3, $4, $5)
       RETURNING *`,
      [nombre.toLowerCase().trim().replace(/\s+/g, '-'), descripcion, esPrivado, Boolean(soloLectura), creadorId]
    );
    const canal = rows[0];

    if (!esPrivado) {
      await client.query(
        `INSERT INTO chat_interno_miembros(canal_id, agente_id, rol, activo)
         SELECT $1, id, CASE WHEN id = $2 THEN 'admin' ELSE 'miembro' END, TRUE
         FROM agentes
         ON CONFLICT DO NOTHING`,
        [canal.id, creadorId]
      );
    } else {
      const allMembers = Array.from(new Set([creadorId, ...miembroIds]));
      for (const agId of allMembers) {
        await client.query(
          `INSERT INTO chat_interno_miembros(canal_id, agente_id, rol, activo)
           VALUES ($1, $2, $3, TRUE)
           ON CONFLICT DO NOTHING`,
          [canal.id, agId, agId === creadorId ? 'admin' : 'miembro']
        );
      }
    }

    await client.query('COMMIT');
    return canal;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Obtiene la información de un canal específico y valida acceso del agente.
 */
async function getCanalById(canalId, agenteId) {
  const query = `
    SELECT 
      c.id, c.nombre, c.descripcion, c.tipo, c.es_privado, c.solo_lectura, c.creador_id, c.created_at,
      c.eliminado AS canal_eliminado, c.eliminado_en,
      a_creador.nombre AS creador_nombre,
      COALESCE(m_me.activo, TRUE) AS soy_miembro_activo,
      m_me.salido_en,
      CASE 
        WHEN c.tipo = 'directo' THEN (
          SELECT json_build_object(
            'id', a.id,
            'nombre', a.nombre,
            'email', a.email,
            'foto_perfil', a.foto_perfil,
            'rol', a.rol,
            'area', a.area,
            'esta_online', a.esta_online,
            'last_seen', a.last_seen
          )
          FROM chat_interno_miembros m2
          JOIN agentes a ON a.id = m2.agente_id
          WHERE m2.canal_id = c.id AND m2.agente_id != $2
          LIMIT 1
        )
        ELSE NULL
      END AS otro_participante
    FROM chat_interno_canales c
    LEFT JOIN agentes a_creador ON a_creador.id = c.creador_id
    LEFT JOIN chat_interno_miembros m_me ON m_me.canal_id = c.id AND m_me.agente_id = $2
    WHERE c.id = $1
      AND (
        (c.tipo = 'canal' AND c.es_privado = FALSE)
        OR m_me.agente_id IS NOT NULL
      )
  `;
  const { rows } = await db.query(query, [canalId, agenteId]);
  return rows[0] || null;
}

/**
 * Obtiene los mensajes paginados de un canal con sus reacciones agrupadas.
 * Si el usuario fue removido, solo devuelve el historial hasta la fecha de su salida.
 */
async function getMensajesByCanal(canalId, agenteId, limit = 50, beforeId = null) {
  // Verificar si el agente fue removido del canal
  const { rows: [member] } = await db.query(
    'SELECT activo, salido_en FROM chat_interno_miembros WHERE canal_id = $1 AND agente_id = $2',
    [canalId, agenteId]
  );

  let query = `
    SELECT 
      m.id,
      m.canal_id,
      m.emisor_id,
      m.mensaje,
      m.tipo,
      m.url_adjunto,
      m.nombre_adjunto,
      m.tamano_adjunto,
      m.created_at,
      a.nombre AS emisor_nombre,
      a.foto_perfil AS emisor_foto,
      a.rol AS emisor_rol,
      a.area AS emisor_area,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'emoji', r_group.emoji,
              'count', r_group.count,
              'reacted_by_me', r_group.reacted_by_me,
              'agentes', r_group.agentes
            )
          )
          FROM (
            SELECT 
              r.emoji,
              COUNT(*)::int AS count,
              BOOL_OR(r.agente_id = $2) AS reacted_by_me,
              json_agg(a_r.nombre) AS agentes
            FROM chat_interno_reacciones r
            JOIN agentes a_r ON a_r.id = r.agente_id
            WHERE r.mensaje_id = m.id
            GROUP BY r.emoji
          ) r_group
        ),
        '[]'::json
      ) AS reacciones
    FROM chat_interno_mensajes m
    JOIN agentes a ON a.id = m.emisor_id
    WHERE m.canal_id = $1
  `;
  const params = [canalId, agenteId];

  // Si fue removido, limitar mensajes hasta salido_en
  if (member && member.activo === false && member.salido_en) {
    params.push(member.salido_en);
    query += ` AND m.created_at <= $${params.length}`;
  }

  if (beforeId) {
    params.push(beforeId);
    query += ` AND m.id < $${params.length}`;
  }

  params.push(limit);
  query += ` ORDER BY m.id DESC LIMIT $${params.length}`;

  const { rows } = await db.query(query, params);
  return rows.reverse();
}

/**
 * Alterna una reacción emoji en un mensaje.
 */
async function toggleReaccion(mensajeId, agenteId, emoji) {
  const check = await db.query(
    'SELECT id FROM chat_interno_reacciones WHERE mensaje_id = $1 AND agente_id = $2 AND emoji = $3',
    [mensajeId, agenteId, emoji]
  );

  if (check.rows.length > 0) {
    await db.query(
      'DELETE FROM chat_interno_reacciones WHERE mensaje_id = $1 AND agente_id = $2 AND emoji = $3',
      [mensajeId, agenteId, emoji]
    );
  } else {
    await db.query(
      'INSERT INTO chat_interno_reacciones(mensaje_id, agente_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [mensajeId, agenteId, emoji]
    );
  }

  const query = `
    SELECT 
      r.emoji,
      COUNT(*)::int AS count,
      BOOL_OR(r.agente_id = $2) AS reacted_by_me,
      json_agg(a.nombre) AS agentes
    FROM chat_interno_reacciones r
    JOIN agentes a ON a.id = r.agente_id
    WHERE r.mensaje_id = $1
    GROUP BY r.emoji
  `;
  const { rows } = await db.query(query, [mensajeId, agenteId]);
  return rows;
}

/**
 * Obtiene los miembros activos y los archivos compartidos de un canal.
 */
async function getDetallesCanal(canalId) {
  const miembrosQuery = `
    SELECT 
      a.id, a.nombre, a.email, a.rol, a.area, a.esta_online, COALESCE(a.estado_presencia, 'disponible') AS estado_presencia, a.mensaje_presencia, a.foto_perfil,
      m.rol AS canal_rol, m.unido_en
    FROM chat_interno_miembros m
    JOIN agentes a ON a.id = m.agente_id
    WHERE m.canal_id = $1 AND m.activo = TRUE
    ORDER BY (m.rol = 'admin') DESC, a.esta_online DESC, a.nombre ASC
  `;
  const { rows: miembros } = await db.query(miembrosQuery, [canalId]);

  const archivosQuery = `
    SELECT 
      id, emisor_id, mensaje, tipo, url_adjunto, nombre_adjunto, tamano_adjunto, created_at
    FROM chat_interno_mensajes
    WHERE canal_id = $1 AND url_adjunto IS NOT NULL
    ORDER BY id DESC
  `;
  const { rows: archivos } = await db.query(archivosQuery, [canalId]);

  return { miembros, archivos };
}

/**
 * Agrega o reactiva un miembro en un canal.
 */
async function agregarMiembro(canalId, agenteId, rol = 'miembro') {
  await db.query(
    `INSERT INTO chat_interno_miembros(canal_id, agente_id, rol, activo, salido_en, removido_por_id)
     VALUES ($1, $2, $3, TRUE, NULL, NULL)
     ON CONFLICT (canal_id, agente_id)
     DO UPDATE SET activo = TRUE, salido_en = NULL, removido_por_id = NULL, rol = EXCLUDED.rol`,
    [canalId, agenteId, rol]
  );
}

/**
 * Remueve a un miembro marcándolo como inactivo y registrando la fecha de salida.
 * No se elimina su fila para que pueda conservar el historial anterior.
 */
async function removerMiembro(canalId, agenteId, solicitanteId) {
  await db.query(
    `UPDATE chat_interno_miembros
     SET activo = FALSE, salido_en = NOW(), removido_por_id = $3
     WHERE canal_id = $1 AND agente_id = $2`,
    [canalId, agenteId, solicitanteId]
  );
}

async function insertMensaje(canalId, emisorId, mensaje, tipo = 'texto', urlAdjunto = null, nombreAdjunto = null, tamanoAdjunto = null) {
  const insertQuery = `
    INSERT INTO chat_interno_mensajes(canal_id, emisor_id, mensaje, tipo, url_adjunto, nombre_adjunto, tamano_adjunto)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  const { rows: [nuevo] } = await db.query(insertQuery, [
    canalId, emisorId, mensaje, tipo, urlAdjunto, nombreAdjunto, tamanoAdjunto
  ]);

  const { rows: [emisor] } = await db.query(
    'SELECT nombre, foto_perfil, rol, area FROM agentes WHERE id=$1',
    [emisorId]
  );

  return {
    ...nuevo,
    emisor_nombre: emisor?.nombre || 'Usuario',
    emisor_foto:   emisor?.foto_perfil || null,
    emisor_rol:    emisor?.rol || 'asesor',
    emisor_area:   emisor?.area || '',
    reacciones:    []
  };
}

async function marcarLeido(canalId, agenteId, ultimoMensajeId) {
  const query = `
    INSERT INTO chat_interno_leidos(canal_id, agente_id, ultimo_mensaje_leido_id, actualizado_en)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (canal_id, agente_id)
    DO UPDATE SET 
      ultimo_mensaje_leido_id = GREATEST(chat_interno_leidos.ultimo_mensaje_leido_id, EXCLUDED.ultimo_mensaje_leido_id),
      actualizado_en = NOW()
  `;
  await db.query(query, [canalId, agenteId, ultimoMensajeId]);
}

async function getContactos(agenteIdActual) {
  const query = `
    SELECT 
      id, nombre, email, rol, area, esta_online, COALESCE(estado_presencia, 'disponible') AS estado_presencia, mensaje_presencia, last_seen, foto_perfil
    FROM agentes
    WHERE id != $1 AND rol != 'ti'
    ORDER BY esta_online DESC, nombre ASC
  `;
  const { rows } = await db.query(query, [agenteIdActual]);
  return rows;
}

/**
 * Obtiene solo los IDs de miembros activos del canal.
 */
async function getMiembrosIds(canalId) {
  const query = `SELECT agente_id FROM chat_interno_miembros WHERE canal_id = $1 AND activo = TRUE`;
  const { rows } = await db.query(query, [canalId]);
  return rows.map(r => r.agente_id);
}

/**
 * Cierra / archiva un canal a nivel global y desactiva a todos sus miembros.
 */
async function archivarCanal(canalId, solicitanteId) {
  await db.query(
    `UPDATE chat_interno_canales
     SET eliminado = TRUE, eliminado_en = NOW(), eliminado_por_id = $2
     WHERE id = $1`,
    [canalId, solicitanteId]
  );

  await db.query(
    `UPDATE chat_interno_miembros
     SET activo = FALSE, salido_en = NOW()
     WHERE canal_id = $1`,
    [canalId]
  );
}

/**
 * Oculta la conversación / canal únicamente para el agente solicitante.
 */
async function ocultarCanalParaAgente(canalId, agenteId) {
  await db.query(
    `INSERT INTO chat_interno_miembros(canal_id, agente_id, rol, activo, oculto)
     VALUES ($1, $2, 'miembro', FALSE, TRUE)
     ON CONFLICT (canal_id, agente_id)
     DO UPDATE SET oculto = TRUE`,
    [canalId, agenteId]
  );
}

/**
 * Elimina un canal y toda su información relacionada por cascada.
 */
async function deleteCanal(canalId) {
  await db.query('DELETE FROM chat_interno_canales WHERE id = $1', [canalId]);
}

module.exports = {
  archivarCanal,
  ocultarCanalParaAgente,
  deleteCanal,
  getCanalesByAgente,
  findDirectChannel,
  createDirectChannel,
  createCanal,
  getCanalById,
  getMensajesByCanal,
  toggleReaccion,
  getDetallesCanal,
  agregarMiembro,
  removerMiembro,
  insertMensaje,
  marcarLeido,
  getContactos,
  getMiembrosIds,
};
