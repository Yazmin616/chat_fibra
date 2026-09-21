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
      c.foto,
      c.mensajes_temporales,
      c.permisos,
      c.creador_id,
      c.created_at,
      c.eliminado AS canal_eliminado,
      c.eliminado_en,
      COALESCE(m_me.activo, TRUE) AS soy_miembro_activo,
      m_me.salido_en,
      COALESCE(m_me.fijado, FALSE) AS fijado,
      m_me.fijado_en,
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
            'last_seen', a.last_seen,
            'empresas', COALESCE(
              (SELECT array_agg(ue.empresa_id) FROM usuario_empresas ue WHERE ue.usuario_id = a.id),
              ARRAY['__todas__']::varchar[]
            )
          )
          FROM chat_interno_miembros m2
          JOIN agentes a ON a.id = m2.agente_id
          WHERE m2.canal_id = c.id AND m2.agente_id != $1
          LIMIT 1
        )
        ELSE NULL
      END AS otro_participante,
      (
        SELECT string_agg(a_m.nombre, ', ' ORDER BY (cm.agente_id = $1) DESC, a_m.nombre ASC)
        FROM chat_interno_miembros cm
        JOIN agentes a_m ON a_m.id = cm.agente_id
        WHERE cm.canal_id = c.id AND cm.activo = TRUE
      ) AS miembros_resumen,
      (
        SELECT json_build_object(
          'id', m.id,
          'mensaje', m.mensaje,
          'tipo', m.tipo,
          'url_adjunto', m.url_adjunto,
          'nombre_adjunto', m.nombre_adjunto,
          'emisor_id', m.emisor_id,
          'emisor_nombre', a_emisor.nombre,
          'created_at', m.created_at,
          'leido', (
            CASE 
              WHEN c.tipo = 'directo' THEN (
                COALESCE((SELECT l.ultimo_mensaje_leido_id FROM chat_interno_leidos l WHERE l.canal_id = c.id AND l.agente_id != m.emisor_id LIMIT 1), 0) >= m.id
              )
              ELSE (
                (SELECT COUNT(*)::int FROM chat_interno_miembros cm2 WHERE cm2.canal_id = c.id AND cm2.agente_id != m.emisor_id AND cm2.activo = TRUE) > 0
                AND
                (SELECT COALESCE(MIN(COALESCE(l.ultimo_mensaje_leido_id, 0)), 0) FROM chat_interno_miembros cm2 LEFT JOIN chat_interno_leidos l ON l.canal_id = cm2.canal_id AND l.agente_id = cm2.agente_id WHERE cm2.canal_id = c.id AND cm2.agente_id != m.emisor_id AND cm2.activo = TRUE) >= m.id
              )
            END
          ),
          'entregado', (
            CASE 
              WHEN c.tipo = 'directo' THEN (
                COALESCE((SELECT a_dest.esta_online FROM chat_interno_miembros cm2 JOIN agentes a_dest ON a_dest.id = cm2.agente_id WHERE cm2.canal_id = c.id AND cm2.agente_id != m.emisor_id LIMIT 1), FALSE)
              )
              ELSE (
                EXISTS (SELECT 1 FROM chat_interno_miembros cm2 JOIN agentes a_dest ON a_dest.id = cm2.agente_id WHERE cm2.canal_id = c.id AND cm2.agente_id != m.emisor_id AND cm2.activo = TRUE AND a_dest.esta_online = TRUE)
              )
            END
          )
        )
        FROM chat_interno_mensajes m
        JOIN agentes a_emisor ON a_emisor.id = m.emisor_id
        WHERE m.canal_id = c.id
          AND (m_me.activo IS NOT FALSE OR m_me.salido_en IS NULL OR m.created_at <= m_me.salido_en)
        ORDER BY m.id DESC
        LIMIT 1
      ) AS ultimo_mensaje,
      (
        SELECT json_build_object(
          'id', r.id,
          'mensaje_id', r.mensaje_id,
          'emoji', r.emoji,
          'agente_id', r.agente_id,
          'agente_nombre', a_reac.nombre,
          'created_at', r.created_at,
          'mensaje_emisor_id', m_reac.emisor_id,
          'mensaje_emisor_nombre', a_msg_emisor.nombre,
          'mensaje_texto', m_reac.mensaje,
          'mensaje_tipo', m_reac.tipo,
          'mensaje_url_adjunto', m_reac.url_adjunto
        )
        FROM chat_interno_reacciones r
        JOIN agentes a_reac ON a_reac.id = r.agente_id
        JOIN chat_interno_mensajes m_reac ON m_reac.id = r.mensaje_id
        JOIN agentes a_msg_emisor ON a_msg_emisor.id = m_reac.emisor_id
        WHERE m_reac.canal_id = c.id
        ORDER BY r.id DESC
        LIMIT 1
      ) AS ultima_reaccion,
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
    JOIN chat_interno_miembros m_me ON m_me.canal_id = c.id AND m_me.agente_id = $1
    WHERE 
      COALESCE(c.eliminado, FALSE) = FALSE
      AND m_me.activo = TRUE
      AND COALESCE(m_me.oculto, FALSE) = FALSE
    ORDER BY 
      COALESCE(m_me.fijado, FALSE) DESC,
      m_me.fijado_en DESC,
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
async function createCanal(nombre, descripcion, esPrivado, soloLectura, creadorId, miembroIds = [], adminIds = [], foto = null, mensajesTemporales = 'desactivados', permisos = null) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO chat_interno_canales(nombre, descripcion, tipo, es_privado, solo_lectura, creador_id, foto, mensajes_temporales, permisos)
       VALUES ($1, $2, 'canal', $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        nombre.trim(),
        descripcion || '',
        esPrivado,
        Boolean(soloLectura),
        creadorId,
        foto,
        mensajesTemporales || 'desactivados',
        permisos ? JSON.stringify(permisos) : JSON.stringify({
          editar_ajustes: true,
          enviar_mensajes: true,
          agregar_miembros: true,
          enlace_invitacion: true,
          aprobar_miembros: false
        })
      ]
    );
    const canal = rows[0];

    const adminSet = new Set([Number(creadorId), ...adminIds.map(Number)]);

    if (!esPrivado) {
      const { rows: agentes } = await client.query('SELECT id FROM agentes');
      for (const ag of agentes) {
        const rol = adminSet.has(Number(ag.id)) ? 'admin' : 'miembro';
        await client.query(
          `INSERT INTO chat_interno_miembros(canal_id, agente_id, rol, activo)
           VALUES ($1, $2, $3, TRUE)
           ON CONFLICT (canal_id, agente_id) DO UPDATE SET activo = TRUE, rol = EXCLUDED.rol`,
          [canal.id, ag.id, rol]
        );
        await client.query(
          `INSERT INTO chat_interno_periodos_membresia(canal_id, agente_id, unido_en)
           VALUES ($1, $2, NOW())`,
          [canal.id, ag.id]
        );
      }
    } else {
      const allMembers = Array.from(new Set([Number(creadorId), ...miembroIds.map(Number), ...adminIds.map(Number)]));
      for (const agId of allMembers) {
        const rol = adminSet.has(Number(agId)) ? 'admin' : 'miembro';
        await client.query(
          `INSERT INTO chat_interno_miembros(canal_id, agente_id, rol, activo)
           VALUES ($1, $2, $3, TRUE)
           ON CONFLICT (canal_id, agente_id) DO UPDATE SET activo = TRUE, rol = EXCLUDED.rol`,
          [canal.id, agId, rol]
        );
        await client.query(
          `INSERT INTO chat_interno_periodos_membresia(canal_id, agente_id, unido_en)
           VALUES ($1, $2, NOW())`,
          [canal.id, agId]
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
      c.foto, c.mensajes_temporales, c.permisos,
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
  // Obtener info del canal y creador
  const { rows: [canal] } = await db.query(
    'SELECT tipo, creador_id, mensajes_temporales FROM chat_interno_canales WHERE id = $1',
    [canalId]
  );

  // Asegurar que solo exista un mensaje fijado por canal (el fijado con fecha y horario más reciente)
  try {
    await db.query(`
      UPDATE chat_interno_mensajes
      SET fijado = FALSE, fijado_por = NULL, fijado_en = NULL, fijado_hasta = NULL
      WHERE canal_id = $1
        AND fijado = TRUE
        AND id NOT IN (
          SELECT id FROM chat_interno_mensajes
          WHERE canal_id = $1 
            AND fijado = TRUE
            AND (fijado_hasta IS NULL OR fijado_hasta > NOW())
            AND (eliminado IS NOT TRUE)
          ORDER BY COALESCE(fijado_en, created_at) DESC, id DESC
          LIMIT 1
        )
    `, [canalId]);
  } catch (errCleanup) {
    console.warn('Advertencia al limpiar mensajes fijados:', errCleanup.message);
  }

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
      m.editado_en,
      (COALESCE(m.fijado, FALSE) AND (m.fijado_hasta IS NULL OR m.fijado_hasta > NOW())) AS fijado,
      m.fijado_por,
      m.fijado_en,
      m.fijado_hasta,
      COALESCE(m.eliminado, FALSE) AS eliminado,
      (EXISTS (SELECT 1 FROM chat_interno_destacados d WHERE d.mensaje_id = m.id AND d.agente_id = $2)) AS destacado,
      a.nombre AS emisor_nombre,
      a.foto_perfil AS emisor_foto,
      a.rol AS emisor_rol,
      a.area AS emisor_area,
      ${canal?.tipo === 'directo' 
        ? `(COALESCE((SELECT l.ultimo_mensaje_leido_id FROM chat_interno_leidos l WHERE l.canal_id = m.canal_id AND l.agente_id != m.emisor_id LIMIT 1), 0) >= m.id)`
        : `(
            (SELECT COUNT(*)::int FROM chat_interno_miembros cm2 WHERE cm2.canal_id = m.canal_id AND cm2.agente_id != m.emisor_id AND cm2.activo = TRUE) > 0
            AND
            (SELECT COALESCE(MIN(COALESCE(l.ultimo_mensaje_leido_id, 0)), 0) FROM chat_interno_miembros cm2 LEFT JOIN chat_interno_leidos l ON l.canal_id = cm2.canal_id AND l.agente_id = cm2.agente_id WHERE cm2.canal_id = m.canal_id AND cm2.agente_id != m.emisor_id AND cm2.activo = TRUE) >= m.id
          )`
      } AS leido,
      ${canal?.tipo === 'directo'
        ? `1`
        : `(SELECT COUNT(*)::int FROM chat_interno_miembros cm2 WHERE cm2.canal_id = m.canal_id AND cm2.agente_id != m.emisor_id AND cm2.activo = TRUE)`
      } AS total_destinatarios,
      ${canal?.tipo === 'directo'
        ? `(CASE WHEN COALESCE((SELECT l.ultimo_mensaje_leido_id FROM chat_interno_leidos l WHERE l.canal_id = m.canal_id AND l.agente_id != m.emisor_id LIMIT 1), 0) >= m.id THEN 1 ELSE 0 END)`
        : `(SELECT COUNT(*)::int FROM chat_interno_miembros cm2 JOIN chat_interno_leidos l ON l.canal_id = cm2.canal_id AND l.agente_id = cm2.agente_id WHERE cm2.canal_id = m.canal_id AND cm2.agente_id != m.emisor_id AND cm2.activo = TRUE AND l.ultimo_mensaje_leido_id >= m.id)`
      } AS leidos_count,
      COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', a_lector.id,
            'nombre', a_lector.nombre,
            'foto_perfil', a_lector.foto_perfil,
            'leido_en', l.actualizado_en
          )
        )
        FROM chat_interno_miembros cm2
        JOIN chat_interno_leidos l ON l.canal_id = cm2.canal_id AND l.agente_id = cm2.agente_id
        JOIN agentes a_lector ON a_lector.id = cm2.agente_id
        WHERE cm2.canal_id = m.canal_id 
          AND cm2.agente_id != m.emisor_id 
          AND cm2.activo = TRUE 
          AND l.ultimo_mensaje_leido_id >= m.id
      ), '[]'::json) AS lectores,
      ${canal?.tipo === 'directo'
        ? `(COALESCE((SELECT a_dest.esta_online FROM chat_interno_miembros cm2 JOIN agentes a_dest ON a_dest.id = cm2.agente_id WHERE cm2.canal_id = m.canal_id AND cm2.agente_id != m.emisor_id LIMIT 1), FALSE))`
        : `TRUE`
      } AS entregado,
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

  // FILTRADO ESTRICTO POR PERÍODOS DE MEMBRESÍA:
  // En canales grupales, el colaborador SOLO puede ver los mensajes emitidos durante
  // los lapsos de tiempo en los que estuvo activo (nunca mensajes durante sus períodos de expulsión).
  if (canal?.tipo === 'canal') {
    query += `
      AND (
        EXISTS (
          SELECT 1 FROM chat_interno_periodos_membresia p
          WHERE p.canal_id = m.canal_id
            AND p.agente_id = $2
            AND m.created_at >= p.unido_en
            AND (p.salido_en IS NULL OR m.created_at <= p.salido_en)
        )
        OR NOT EXISTS (
          SELECT 1 FROM chat_interno_periodos_membresia p2
          WHERE p2.canal_id = m.canal_id AND p2.agente_id = $2
        )
      )
    `;
  }

  // MENSAJES TEMPORALES (WhatsApp): si el canal tiene caducidad activa (24h, 7d, 90d),
  // los mensajes anteriores a esa ventana no se cargan, excepto si fueron conservados/destacados o fijados.
  if (canal?.mensajes_temporales && canal.mensajes_temporales !== 'desactivados') {
    let intervalSql = null;
    if (canal.mensajes_temporales === '24h') intervalSql = "INTERVAL '24 hours'";
    else if (canal.mensajes_temporales === '7d') intervalSql = "INTERVAL '7 days'";
    else if (canal.mensajes_temporales === '90d') intervalSql = "INTERVAL '90 days'";

    if (intervalSql) {
      query += `
        AND (
          m.created_at >= NOW() - ${intervalSql}
          OR (COALESCE(m.fijado, FALSE) = TRUE)
          OR EXISTS (SELECT 1 FROM chat_interno_destacados d WHERE d.mensaje_id = m.id AND d.agente_id = $2)
        )
      `;
    }
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

  let agregado = false;
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
    agregado = true;
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

  // Obtener info del mensaje y agentes para actualizar vista previa en tiempo real
  const { rows: [msgInfo] } = await db.query(
    `SELECT m.id, m.canal_id, m.emisor_id, m.mensaje, m.tipo, m.url_adjunto,
            a.nombre AS emisor_nombre, a_reac.nombre AS agente_nombre
     FROM chat_interno_mensajes m
     JOIN agentes a ON a.id = m.emisor_id
     CROSS JOIN (SELECT nombre FROM agentes WHERE id = $2) a_reac
     WHERE m.id = $1`,
    [mensajeId, agenteId]
  );

  let ultimaReaccion = null;
  if (agregado && msgInfo) {
    ultimaReaccion = {
      mensaje_id: Number(mensajeId),
      emoji,
      agente_id: Number(agenteId),
      agente_nombre: msgInfo.agente_nombre || 'Usuario',
      created_at: new Date().toISOString(),
      mensaje_emisor_id: Number(msgInfo.emisor_id),
      mensaje_emisor_nombre: msgInfo.emisor_nombre || 'Usuario',
      mensaje_texto: msgInfo.mensaje,
      mensaje_tipo: msgInfo.tipo,
      mensaje_url_adjunto: msgInfo.url_adjunto
    };
  }

  return {
    reacciones: rows,
    agregado,
    ultimaReaccion,
    canalId: msgInfo?.canal_id || null
  };
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
      m.id, m.emisor_id, m.mensaje, m.tipo, m.url_adjunto, m.nombre_adjunto, m.tamano_adjunto, m.created_at,
      a.nombre AS emisor_nombre, a.foto_perfil AS emisor_foto
    FROM chat_interno_mensajes m
    LEFT JOIN agentes a ON a.id = m.emisor_id
    WHERE m.canal_id = $1 
      AND (
        m.url_adjunto IS NOT NULL 
        OR m.tipo IN ('sticker', 'audio', 'imagen', 'video', 'archivo') 
        OR m.mensaje ~* 'https?://'
      )
      AND (m.eliminado IS NOT TRUE)
    ORDER BY m.id DESC
  `;
  const { rows: archivos } = await db.query(archivosQuery, [canalId]);

  return { miembros, archivos };
}

/**
 * Agrega o reactiva un miembro en un canal.
 */
async function agregarMiembro(canalId, agenteId, rol = 'miembro') {
  await db.query(
    `INSERT INTO chat_interno_miembros(canal_id, agente_id, rol, activo, salido_en, removido_por_id, unido_en)
     VALUES ($1, $2, $3, TRUE, NULL, NULL, NOW())
     ON CONFLICT (canal_id, agente_id)
     DO UPDATE SET activo = TRUE, salido_en = NULL, removido_por_id = NULL, rol = EXCLUDED.rol`,
    [canalId, agenteId, rol]
  );
  // Iniciar nuevo período de membresía si no hay uno abierto actualmente
  await db.query(
    `INSERT INTO chat_interno_periodos_membresia(canal_id, agente_id, unido_en)
     SELECT $1, $2, NOW()
     WHERE NOT EXISTS (
       SELECT 1 FROM chat_interno_periodos_membresia
       WHERE canal_id = $1 AND agente_id = $2 AND salido_en IS NULL
     )`,
    [canalId, agenteId]
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
  // Cerrar el período de membresía activo
  await db.query(
    `UPDATE chat_interno_periodos_membresia
     SET salido_en = NOW()
     WHERE canal_id = $1 AND agente_id = $2 AND salido_en IS NULL`,
    [canalId, agenteId]
  );
}

/**
 * Cambia el rol de un miembro en el canal ('admin' o 'miembro').
 */
async function cambiarRolMiembro(canalId, agenteId, nuevoRol) {
  await db.query(
    `UPDATE chat_interno_miembros
     SET rol = $3
     WHERE canal_id = $1 AND agente_id = $2 AND activo = TRUE`,
    [canalId, agenteId, nuevoRol]
  );
}

/**
 * Transfiere la titularidad/anfitrión del canal a un nuevo agente.
 */
async function transferirAnfitrion(canalId, nuevoCreadorId) {
  await db.query(
    `UPDATE chat_interno_canales
     SET creador_id = $2
     WHERE id = $1`,
    [canalId, nuevoCreadorId]
  );
  // Asegurar que el nuevo anfitrión tenga rol de admin en el canal
  await db.query(
    `UPDATE chat_interno_miembros
     SET rol = 'admin'
     WHERE canal_id = $1 AND agente_id = $2`,
    [canalId, nuevoCreadorId]
  );
}

/**
 * Busca al siguiente candidato para ser anfitrión entre los miembros activos restantes:
 * 1. Prioridad: Administradores activos ordenados por antigüedad en el canal (unido_en ASC).
 * 2. Fallback: Miembros activos ordenados por antigüedad (unido_en ASC).
 */
async function obtenerSiguienteAnfitrion(canalId, excluirAgenteId) {
  const query = `
    SELECT m.agente_id, m.rol, a.nombre, a.email
    FROM chat_interno_miembros m
    JOIN agentes a ON a.id = m.agente_id
    WHERE m.canal_id = $1
      AND m.activo = TRUE
      AND m.agente_id != $2
    ORDER BY (m.rol = 'admin') DESC, m.unido_en ASC, m.agente_id ASC
    LIMIT 1
  `;
  const { rows } = await db.query(query, [canalId, excluirAgenteId]);
  return rows[0] || null;
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

  const { rows: [dest] } = await db.query(`
    SELECT EXISTS (
      SELECT 1 FROM chat_interno_miembros cm
      JOIN agentes a ON a.id = cm.agente_id
      WHERE cm.canal_id = $1 AND cm.agente_id != $2 AND cm.activo = TRUE AND a.esta_online = TRUE
    ) AS entregado
  `, [canalId, emisorId]);

  return {
    ...nuevo,
    emisor_nombre: emisor?.nombre || 'Usuario',
    emisor_foto:   emisor?.foto_perfil || null,
    emisor_rol:    emisor?.rol || 'asesor',
    emisor_area:   emisor?.area || '',
    reacciones:    [],
    leido:         false,
    entregado:     Boolean(dest?.entregado)
  };
}

async function marcarLeido(canalId, agenteId, ultimoMensajeId) {
  let targetId = ultimoMensajeId ? Number(ultimoMensajeId) : null;
  if (!targetId || isNaN(targetId)) {
    // Si no se especifica o viene null, encontrar el id máximo de mensaje que el usuario puede ver
    const { rows } = await db.query(`
      SELECT COALESCE(MAX(m.id), 0) AS max_id
      FROM chat_interno_mensajes m
      LEFT JOIN chat_interno_miembros cm ON cm.canal_id = m.canal_id AND cm.agente_id = $2
      WHERE m.canal_id = $1
        AND (cm.activo IS NOT FALSE OR cm.salido_en IS NULL OR m.created_at <= cm.salido_en)
    `, [canalId, agenteId]);
    targetId = rows[0]?.max_id ? Number(rows[0].max_id) : 0;
  }

  const query = `
    INSERT INTO chat_interno_leidos(canal_id, agente_id, ultimo_mensaje_leido_id, actualizado_en)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (canal_id, agente_id)
    DO UPDATE SET 
      ultimo_mensaje_leido_id = GREATEST(COALESCE(chat_interno_leidos.ultimo_mensaje_leido_id, 0), EXCLUDED.ultimo_mensaje_leido_id),
      actualizado_en = NOW()
  `;
  await db.query(query, [canalId, agenteId, targetId]);

  // Obtener tipo de canal y estado de lecturas de todos los miembros
  const canalRes = await db.query('SELECT tipo FROM chat_interno_canales WHERE id = $1', [canalId]);
  const tipo = canalRes.rows[0]?.tipo || 'canal';

  const miembrosRes = await db.query(`
    SELECT cm.agente_id, COALESCE(l.ultimo_mensaje_leido_id, 0) AS ultimo_leido, l.actualizado_en
    FROM chat_interno_miembros cm
    LEFT JOIN chat_interno_leidos l ON l.canal_id = cm.canal_id AND l.agente_id = cm.agente_id
    WHERE cm.canal_id = $1 AND cm.activo = TRUE
  `, [canalId]);

  const lecturas = {};
  const miembros_activos = [];
  miembrosRes.rows.forEach(r => {
    const aid = Number(r.agente_id);
    lecturas[aid] = Number(r.ultimo_leido);
    miembros_activos.push(aid);
  });

  return {
    canalId: Number(canalId),
    agenteId: Number(agenteId),
    ultimoMensajeId: targetId,
    tipo,
    lecturas,
    miembros_activos
  };
}

async function getContactos(agenteIdActual) {
  const query = `
    SELECT 
      a.id, a.nombre, a.email, a.rol, a.area, a.esta_online, 
      COALESCE(a.estado_presencia, 'disponible') AS estado_presencia, 
      a.mensaje_presencia, a.last_seen, a.foto_perfil,
      COALESCE(
        (SELECT array_agg(ue.empresa_id) FROM usuario_empresas ue WHERE ue.usuario_id = a.id),
        ARRAY['__todas__']::varchar[]
      ) AS empresas
    FROM agentes a
    WHERE a.id != $1
    ORDER BY a.esta_online DESC, a.nombre ASC
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
 * Alterna el estado fijado (Pin / Unpin) de un canal o chat para un agente específico.
 */
async function toggleFijarCanal(canalId, agenteId) {
  const { rows } = await db.query(
    `INSERT INTO chat_interno_miembros(canal_id, agente_id, rol, activo, fijado, fijado_en)
     VALUES ($1, $2, 'miembro', TRUE, TRUE, NOW())
     ON CONFLICT (canal_id, agente_id)
     DO UPDATE SET 
       fijado = NOT COALESCE(chat_interno_miembros.fijado, FALSE),
       fijado_en = CASE WHEN NOT COALESCE(chat_interno_miembros.fijado, FALSE) THEN NOW() ELSE NULL END
     RETURNING fijado`,
    [canalId, agenteId]
  );
  return rows[0]?.fijado || false;
}

/**
 * Elimina un canal y toda su información relacionada por cascada.
 */
async function deleteCanal(canalId) {
  await db.query('DELETE FROM chat_interno_canales WHERE id = $1', [canalId]);
}

/**
 * Edita el texto de un mensaje existente.
 * Solo el emisor original puede editar su mensaje.
 */
async function editarMensaje(mensajeId, agenteId, nuevoTexto) {
  const query = `
    UPDATE chat_interno_mensajes
    SET mensaje = $1, editado_en = NOW()
    WHERE id = $2 AND emisor_id = $3 AND (eliminado IS NOT TRUE)
    RETURNING id, canal_id, emisor_id, mensaje, editado_en
  `;
  const { rows } = await db.query(query, [nuevoTexto, mensajeId, agenteId]);
  return rows[0] || null;
}

/**
 * Alterna el estado fijado de un mensaje con duración configurable estilo WhatsApp.
 */
async function toggleFijarMensaje(mensajeId, agenteId, duracion = '7d') {
  const actualRes = await db.query(
    'SELECT fijado, fijado_hasta FROM chat_interno_mensajes WHERE id = $1',
    [Number(mensajeId)]
  );
  if (!actualRes.rows.length) return null;

  const row = actualRes.rows[0];
  const estaFijado = Boolean(row.fijado) && (!row.fijado_hasta || new Date(row.fijado_hasta) > new Date());

  let query;
  let params;

  if (estaFijado) {
    // Desfijar
    query = `
      UPDATE chat_interno_mensajes
      SET fijado = FALSE, fijado_por = NULL, fijado_en = NULL, fijado_hasta = NULL
      WHERE id = $1
      RETURNING id, canal_id, emisor_id, fijado, fijado_por, fijado_en, fijado_hasta
    `;
    params = [Number(mensajeId)];
  } else {
    // Fijar con duración: SOLAMENTE UN MENSAJE FIJADO POR CANAL
    // Desfijar cualquier otro mensaje previamente fijado en este canal
    await db.query(`
      UPDATE chat_interno_mensajes
      SET fijado = FALSE, fijado_por = NULL, fijado_en = NULL, fijado_hasta = NULL
      WHERE canal_id = (SELECT canal_id FROM chat_interno_mensajes WHERE id = $1)
        AND id != $1
        AND fijado = TRUE
    `, [Number(mensajeId)]);

    let intervalStr = '7 days';
    if (duracion === '24h') intervalStr = '24 hours';
    else if (duracion === '30d') intervalStr = '30 days';

    query = `
      UPDATE chat_interno_mensajes
      SET 
        fijado = TRUE,
        fijado_por = ($2)::integer,
        fijado_en = NOW(),
        fijado_hasta = NOW() + INTERVAL '${intervalStr}'
      WHERE id = $1 AND (eliminado IS NOT TRUE)
      RETURNING id, canal_id, emisor_id, fijado, fijado_por, fijado_en, fijado_hasta
    `;
    params = [Number(mensajeId), Number(agenteId)];
  }

  const { rows } = await db.query(query, params);
  return rows[0] || null;
}

/**
 * Elimina un mensaje (marca como eliminado para todos estilo WhatsApp).
 */
async function eliminarMensaje(mensajeId, agenteId, esAdmin = false) {
  let query;
  let params;
  if (esAdmin) {
    query = `
      UPDATE chat_interno_mensajes
      SET eliminado = TRUE, mensaje = '🚫 Se eliminó este mensaje.'
      WHERE id = $1
      RETURNING id, canal_id, emisor_id, mensaje, eliminado
    `;
    params = [mensajeId];
  } else {
    query = `
      UPDATE chat_interno_mensajes
      SET eliminado = TRUE, mensaje = '🚫 Se eliminó este mensaje.'
      WHERE id = $1 AND emisor_id = $2
      RETURNING id, canal_id, emisor_id, mensaje, eliminado
    `;
    params = [mensajeId, agenteId];
  }
  const { rows } = await db.query(query, params);
  return rows[0] || null;
}

async function actualizarCanal(canalId, { nombre, descripcion, foto, mensajesTemporales, soloLectura }) {
  const updates = [];
  const params = [Number(canalId)];
  let idx = 2;

  if (nombre !== undefined && nombre.trim()) {
    updates.push(`nombre = $${idx++}`);
    params.push(nombre.trim());
  }
  if (descripcion !== undefined) {
    updates.push(`descripcion = $${idx++}`);
    params.push(descripcion.trim());
  }
  if (foto !== undefined) {
    updates.push(`foto = $${idx++}`);
    params.push(foto);
  }
  if (mensajesTemporales !== undefined) {
    updates.push(`mensajes_temporales = $${idx++}`);
    params.push(mensajesTemporales);
  }
  if (soloLectura !== undefined) {
    updates.push(`solo_lectura = $${idx++}`);
    params.push(Boolean(soloLectura));
  }

  if (updates.length === 0) return null;

  const query = `
    UPDATE chat_interno_canales
    SET ${updates.join(', ')}
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await db.query(query, params);
  return rows[0] || null;
}

async function toggleDestacarMensaje(mensajeId, agenteId) {
  const check = await db.query(
    'SELECT 1 FROM chat_interno_destacados WHERE mensaje_id = $1 AND agente_id = $2',
    [mensajeId, agenteId]
  );

  if (check.rows.length > 0) {
    await db.query(
      'DELETE FROM chat_interno_destacados WHERE mensaje_id = $1 AND agente_id = $2',
      [mensajeId, agenteId]
    );
    return { mensajeId, destacado: false };
  } else {
    const msgRes = await db.query(
      'SELECT canal_id FROM chat_interno_mensajes WHERE id = $1',
      [mensajeId]
    );
    if (!msgRes.rows[0]) throw new Error('Mensaje no encontrado');
    const canalId = msgRes.rows[0].canal_id;

    await db.query(
      'INSERT INTO chat_interno_destacados (agente_id, mensaje_id, canal_id) VALUES ($1, $2, $3)',
      [agenteId, mensajeId, canalId]
    );
    return { mensajeId, destacado: true };
  }
}

async function getMensajesDestacadosByCanal(canalId, agenteId) {
  const query = `
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
      TRUE AS destacado,
      d.created_at AS destacado_en
    FROM chat_interno_destacados d
    JOIN chat_interno_mensajes m ON m.id = d.mensaje_id
    JOIN agentes a ON a.id = m.emisor_id
    WHERE d.canal_id = $1 AND d.agente_id = $2
    ORDER BY d.created_at DESC
  `;
  const { rows } = await db.query(query, [canalId, agenteId]);
  return rows;
}

module.exports = {
  archivarCanal,
  ocultarCanalParaAgente,
  deleteCanal,
  getCanalesByAgente,
  findDirectChannel,
  createDirectChannel,
  createCanal,
  actualizarCanal,
  getCanalById,
  getMensajesByCanal,
  toggleReaccion,
  getDetallesCanal,
  agregarMiembro,
  removerMiembro,
  cambiarRolMiembro,
  transferirAnfitrion,
  obtenerSiguienteAnfitrion,
  toggleFijarCanal,
  insertMensaje,
  marcarLeido,
  getContactos,
  getMiembrosIds,
  editarMensaje,
  toggleFijarMensaje,
  eliminarMensaje,
  toggleDestacarMensaje,
  getMensajesDestacadosByCanal,
};
