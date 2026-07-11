/**
 * @file dashboard.service.js
 * @description Lógica de negocio para el panel de KPIs y estadísticas.
 * Consulta y agrega datos de conversaciones y calificaciones para generar:
 *   - KPIs de actividad (chats hoy/semana/mes, activos, cerrados).
 *   - Distribución de calificaciones CSAT (Bien/Regular/Mal).
 *   - Actividad diaria de los últimos 7 días.
 *   - Top asesores por rendimiento (solo Admin).
 *   - Últimas 10 calificaciones individuales.
 *
 * Todas las queries usan parámetros posicionales para prevenir SQL injection.
 * Los filtros de empresa y agente se construyen dinámicamente pero de forma segura.
 */

const db         = require('../config/db');
const agenteRepo = require('../repositories/agente.repository');

/**
 * Obtiene todos los datos del dashboard filtrados por empresa y/o agente.
 *
 * @param {number|string} [agente_id]  - PK del agente solicitante (determina rol y filtro).
 * @param {string}        [empresa_id] - "todas" para sin filtro, o un ID concreto (ej. "fibratec").
 * @returns {Promise<{
 *   kpis: object,
 *   calificaciones: object,
 *   actividadDiaria: object[],
 *   topAgentes: object[],
 *   ultimasCalificaciones: object[]
 * }>}
 */
async function getKpis(agente_id, empresa_id, filtro_agente_id, filtro_area) {
  let esAdmin = false;
  if (agente_id) {
    const { rows } = await agenteRepo.findById(agente_id);
    esAdmin = rows[0]?.rol === 'admin';
  }

  // Construir filtros seguros (parámetros posicionales, no concatenación)
  const f = await _buildFilters(empresa_id, esAdmin, agente_id, filtro_agente_id, filtro_area);

  // Ejecutar todas las queries de lectura en paralelo para mejor rendimiento
  const [kpis, calificaciones, actividadDiaria, ultimasCalificaciones] = await Promise.all([

    // KPIs de actividad — todos con la misma ventana temporal para comparación consistente
    db.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE (c.updated_at AT TIME ZONE 'America/Mexico_City')::date = (NOW() AT TIME ZONE 'America/Mexico_City')::date
        ) AS hoy,
        COUNT(*) FILTER (
          WHERE (c.updated_at AT TIME ZONE 'America/Mexico_City')::date >= (NOW() AT TIME ZONE 'America/Mexico_City')::date - 6
        ) AS semana,
        COUNT(*) FILTER (
          WHERE (c.estado='cerrada' OR c.estado LIKE 'ENCUESTA_%')
            AND (c.updated_at AT TIME ZONE 'America/Mexico_City')::date >= (NOW() AT TIME ZONE 'America/Mexico_City')::date - 6
        ) AS cerrados_semana,
        COUNT(*) FILTER (WHERE c.estado='atendiendo' OR c.estado='ESPERANDO_AGENTE') AS activos
      FROM conversaciones c
      WHERE c.agente_id IS NOT NULL ${f.where}
    `, f.params),

    // Distribución NPS — agente (para el donut) + bot (conversaciones sin atender)
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE cal.tipo='agente' AND cal.puntuacion='5')             AS promotores,
        COUNT(*) FILTER (WHERE cal.tipo='agente' AND cal.puntuacion='4')             AS neutrales,
        COUNT(*) FILTER (WHERE cal.tipo='agente' AND cal.puntuacion IN ('1','2','3')) AS detractores,
        COUNT(*) FILTER (WHERE cal.tipo='agente') AS total,
        COUNT(*) FILTER (WHERE cal.tipo='bot')    AS sin_atencion
      FROM calificaciones cal
      JOIN conversaciones c ON cal.conversacion_id=c.id
      WHERE 1=1 ${f.where}
    `, f.params),

    // Actividad de los últimos 7 días
    db.query(`
      SELECT
        TO_CHAR(c.updated_at AT TIME ZONE 'America/Mexico_City','DD/MM') AS dia,
        COUNT(*) AS chats
      FROM conversaciones c
      WHERE c.agente_id IS NOT NULL
        AND (c.updated_at AT TIME ZONE 'America/Mexico_City')::date >= (NOW() AT TIME ZONE 'America/Mexico_City')::date - 6
        ${f.where}
      GROUP BY TO_CHAR(c.updated_at AT TIME ZONE 'America/Mexico_City','DD/MM'),
               (c.updated_at AT TIME ZONE 'America/Mexico_City')::date
      ORDER BY (c.updated_at AT TIME ZONE 'America/Mexico_City')::date ASC
    `, f.params),

    // Últimas 4 calificaciones individuales — incluye tipo para distinguir bot/agente
    db.query(`
      SELECT cal.puntuacion, cal.tipo, cal.created_at, u.nombre AS cliente, a.nombre AS agente, c.departamento
      FROM calificaciones cal
      JOIN conversaciones c ON cal.conversacion_id=c.id
      JOIN usuarios u ON c.usuario_id=u.id
      LEFT JOIN agentes a ON c.agente_id=a.id
      WHERE 1=1 ${f.where}
      ORDER BY cal.created_at DESC LIMIT 4
    `, f.params)

  ]);

  // Top asesores (solo disponible para Admin y Coordinadores)
  let topAgentes = [];
  const { rows: coordinatedAreas } = agente_id ? await db.query(
    "SELECT nombre_area FROM public.areas_soluciones WHERE coordinador_id = $1",
    [agente_id]
  ) : { rows: [] };
  const areasCoordinadas = coordinatedAreas.map(r => r.nombre_area);
  const esCoordinador = areasCoordinadas.length > 0;

  if (esAdmin || esCoordinador) {
    const ef = _buildEmpresaFilter(empresa_id);
    let areaFilter = '';
    if (!esAdmin && esCoordinador) {
      const placeholders = areasCoordinadas.map((_, i) => `$${ef.params.length + i + 1}`).join(', ');
      ef.params.push(...areasCoordinadas);
      areaFilter = `AND a.area IN (${placeholders})`;
    }

    const { rows } = await db.query(`
      SELECT
        a.id, a.nombre, a.area,
        COUNT(c.id) AS total_chats,
        COUNT(c.id) FILTER (WHERE (c.updated_at AT TIME ZONE 'America/Mexico_City')::date >= (NOW() AT TIME ZONE 'America/Mexico_City')::date - 6) AS esta_semana,
        COUNT(cal.id) AS total_calificaciones,
        ROUND(
          COALESCE(
            (COUNT(cal.id) FILTER (WHERE cal.puntuacion IN ('5')) * 100.0 / NULLIF(COUNT(cal.id), 0))
            -
            (COUNT(cal.id) FILTER (WHERE cal.puntuacion IN ('1','2','3')) * 100.0 / NULLIF(COUNT(cal.id), 0))
          , 0),
          0
        ) AS nps_score
      FROM agentes a
      LEFT JOIN conversaciones c ON c.agente_id=a.id ${ef.joinWhere}
      LEFT JOIN calificaciones cal ON cal.conversacion_id=c.id AND cal.tipo='agente' AND cal.puntuacion IN ('1','2','3','4','5')
      WHERE a.rol='asesor' ${areaFilter}
      GROUP BY a.id, a.nombre, a.area
      ORDER BY nps_score DESC NULLS LAST, total_chats DESC
    `, ef.params);
    topAgentes = rows;
  }

  return {
    kpis:                  kpis.rows[0],
    calificaciones:        calificaciones.rows[0],
    actividadDiaria:       actividadDiaria.rows,
    topAgentes,
    ultimasCalificaciones: ultimasCalificaciones.rows
  };
}

/**
 * Devuelve todas las calificaciones sin límite para la vista completa del modal.
 *
 * @param {number|string} [agente_id]       - PK del agente solicitante (determina rol).
 * @param {string}        [empresa_id]      - ID de empresa o "todas".
 * @param {number|string} [filtro_agente_id]- ID de agente a filtrar (solo admin).
 * @param {string}        [filtro_area]     - Área a filtrar (solo admin).
 * @returns {Promise<object[]>}
 */
async function getCalificaciones(agente_id, empresa_id, filtro_agente_id, filtro_area) {
  let esAdmin = false;
  if (agente_id) {
    const { rows } = await agenteRepo.findById(agente_id);
    esAdmin = rows[0]?.rol === 'admin';
  }
  const f = await _buildFilters(empresa_id, esAdmin, agente_id, filtro_agente_id, filtro_area);
  const { rows } = await db.query(`
    SELECT cal.puntuacion, cal.tipo, cal.created_at, u.nombre AS cliente, a.nombre AS agente, c.departamento
    FROM calificaciones cal
    JOIN conversaciones c ON cal.conversacion_id=c.id
    JOIN usuarios u ON c.usuario_id=u.id
    LEFT JOIN agentes a ON c.agente_id=a.id
    WHERE 1=1 ${f.where}
    ORDER BY cal.created_at DESC
  `, f.params);
  return rows;
}

/**
 * Devuelve las estadísticas NPS exclusivas (1 al 5) agrupadas por agente.
 * Se ignoran las calificaciones con formato viejo ('Bien', 'Regular', 'Mal').
 * @param {string} [empresa_id] - ID de empresa o "todas".
 * @returns {Promise<object[]>}
 */
async function getNpsStats(empresa_id, agente_id) {
  let esAdmin = false;
  if (agente_id) {
    const { rows } = await agenteRepo.findById(agente_id);
    esAdmin = rows[0]?.rol === 'admin';
  }

  const params = [];
  
  // 1. Filtro de empresa (aplica a la tabla conversaciones c de forma opcional en el LEFT JOIN)
  let empresaFilter = '';
  if (empresa_id && empresa_id !== 'todas') {
    params.push(empresa_id);
    empresaFilter = `AND c.empresa_id = $${params.length}`;
  }

  // 2. Filtro de agente/área (aplica a la tabla agentes a en el WHERE)
  let agenteFilter = '';
  if (!esAdmin && agente_id) {
    const { rows: coordinatedAreas } = await db.query(
      "SELECT nombre_area FROM public.areas_soluciones WHERE coordinador_id = $1",
      [agente_id]
    );
    const areasCoordinadas = coordinatedAreas.map(r => r.nombre_area);
    if (areasCoordinadas.length > 0) {
      const placeholders = areasCoordinadas.map((_, i) => `$${params.length + i + 1}`).join(', ');
      params.push(...areasCoordinadas);
      agenteFilter = `AND a.area IN (${placeholders})`;
    } else {
      params.push(agente_id);
      agenteFilter = `AND a.id = $${params.length}`;
    }
  }

  const { rows } = await db.query(`
    SELECT
      a.id,
      a.nombre AS staff,
      a.esta_online,
      a.last_seen,
      COUNT(DISTINCT c.id) AS conversaciones,
      COUNT(cal.id) AS conversaciones_calificadas,
      COUNT(DISTINCT c.id) FILTER (WHERE c.estado = 'ENCUESTA_AGENTE') AS no_contestan,
      COUNT(DISTINCT c.id) FILTER (WHERE c.estado IN ('atendiendo', 'ESPERANDO_AGENTE')) AS chats_activos,
      COUNT(DISTINCT c.id) FILTER (WHERE c.estado = 'ESPERANDO_AGENTE') AS chats_esperando,
      COUNT(cal.id) FILTER (WHERE cal.puntuacion IN ('5')) AS promotores,
      COUNT(cal.id) FILTER (WHERE cal.puntuacion IN ('4')) AS neutrales,
      COUNT(cal.id) FILTER (WHERE cal.puntuacion IN ('3', '2', '1')) AS detractores,
      -- Fórmula NPS = % Promotores - % Detractores
      ROUND(
        COALESCE(
          (COUNT(cal.id) FILTER (WHERE cal.puntuacion IN ('5')) * 100.0 / NULLIF(COUNT(cal.id), 0))
          -
          (COUNT(cal.id) FILTER (WHERE cal.puntuacion IN ('3', '2', '1')) * 100.0 / NULLIF(COUNT(cal.id), 0))
        , 0),
      2) AS nps
    FROM agentes a
    LEFT JOIN conversaciones c ON c.agente_id = a.id ${empresaFilter}
    LEFT JOIN calificaciones cal ON cal.conversacion_id = c.id
      AND cal.tipo = 'agente'
      AND cal.puntuacion IN ('1', '2', '3', '4', '5')
    WHERE a.rol = 'asesor' ${agenteFilter}
    GROUP BY a.id, a.nombre, a.esta_online, a.last_seen
    ORDER BY nps DESC NULLS LAST, conversaciones DESC
  `, params);

  return rows;
}

// ---------------------------------------------------------------------------
// Helpers privados para construcción segura de filtros dinámicos
// ---------------------------------------------------------------------------

/**
 * Construye el fragmento WHERE y el array de parámetros para filtrar
 * por empresa y/o agente. Nunca usa concatenación de strings con datos del usuario.
 * @private
 * @param {string}        empresa_id
 * @param {boolean}       esAdmin
 * @param {number|string} agente_id
 * @returns {{ params: any[], where: string }}
 */
async function _buildFilters(empresa_id, esAdmin, agente_id, filtro_agente_id, filtro_area) {
  const todas   = empresa_id === 'todas';
  const params  = [];
  const clauses = [];

  if (!todas) {
    params.push(empresa_id || 'fibratec');
    clauses.push(`c.empresa_id=$${params.length}`);
  }

  if (!esAdmin && agente_id) {
    // Si no es admin, ver si es coordinador de algún área
    const { rows: coordinatedAreas } = await db.query(
      "SELECT nombre_area FROM public.areas_soluciones WHERE coordinador_id = $1",
      [agente_id]
    );
    const areasCoordinadas = coordinatedAreas.map(r => r.nombre_area);

    if (areasCoordinadas.length > 0) {
      // Si es coordinador, ve todo su departamento / área
      const areaPlaceholders = areasCoordinadas.map((_, i) => `$${params.length + i + 1}`).join(', ');
      params.push(...areasCoordinadas);
      clauses.push(`c.departamento IN (${areaPlaceholders})`);
    } else {
      // Asesor normal: solo ve sus propias conversaciones
      params.push(agente_id);
      clauses.push(`c.agente_id=$${params.length}`);
    }
  } else if (esAdmin && filtro_agente_id) {
    // Admin filtrando por agente específico
    params.push(filtro_agente_id);
    clauses.push(`c.agente_id=$${params.length}`);
  } else if (esAdmin && filtro_area) {
    // Admin filtrando por área
    params.push(filtro_area);
    clauses.push(`c.departamento=$${params.length}`);
  }

  return { params, where: clauses.length > 0 ? 'AND ' + clauses.join(' AND ') : '' };
}

/**
 * Construye el filtro de empresa para el JOIN de la query de top asesores.
 * @private
 * @param {string} empresa_id
 * @returns {{ params: any[], joinWhere: string }}
 */
function _buildEmpresaFilter(empresa_id) {
  if (!empresa_id || empresa_id === 'todas') return { params: [], joinWhere: '' };
  return { params: [empresa_id], joinWhere: 'AND c.empresa_id=$1' };
}

/**
 * Retorna estadísticas detalladas de un asesor específico: resumen global,
 * desglose por empresa, desglose por área, y actividad de los últimos 30 días.
 *
 * @param {number|string} id - PK del agente.
 * @returns {Promise<{ resumen: object, porEmpresa: object[], porArea: object[], actividad: object[] }>}
 */
async function getAgenteStats(id) {
  const [resumen, porEmpresa, porArea, actividad] = await Promise.all([

    db.query(`
      SELECT
        a.nombre, a.area,
        COUNT(DISTINCT c.id)         AS total_conversaciones,
        COUNT(DISTINCT c.usuario_id) AS clientes_unicos,
        COUNT(c.id) FILTER (WHERE (c.updated_at AT TIME ZONE 'America/Mexico_City')::date >= (NOW() AT TIME ZONE 'America/Mexico_City')::date - 6)  AS esta_semana,
        COUNT(c.id) FILTER (WHERE (c.updated_at AT TIME ZONE 'America/Mexico_City')::date >= (NOW() AT TIME ZONE 'America/Mexico_City')::date - 29) AS este_mes,
        COUNT(cal.id) FILTER (WHERE cal.puntuacion='Bien')          AS bien,
        COUNT(cal.id) FILTER (WHERE cal.puntuacion='Regular')       AS regular,
        COUNT(cal.id) FILTER (WHERE cal.puntuacion='Mal')           AS mal,
        COUNT(cal.id) FILTER (WHERE cal.puntuacion='NoRespondida')  AS no_evaluada,
        COUNT(cal.id) FILTER (WHERE cal.puntuacion IN ('Bien','Regular','Mal')) AS total_calificaciones,
        ROUND(
          (
            COUNT(cal.id) FILTER (WHERE cal.puntuacion='Bien')    * 3 +
            COUNT(cal.id) FILTER (WHERE cal.puntuacion='Regular') * 2 +
            COUNT(cal.id) FILTER (WHERE cal.puntuacion='Mal')     * 1
          ) * 100.0 / NULLIF(COUNT(cal.id) FILTER (WHERE cal.puntuacion IN ('Bien','Regular','Mal')) * 3, 0),
          0
        ) AS satisfaccion_pct
      FROM agentes a
      LEFT JOIN conversaciones c   ON c.agente_id=a.id
      LEFT JOIN calificaciones cal ON cal.conversacion_id=c.id AND cal.tipo='agente'
      WHERE a.id=$1
      GROUP BY a.id, a.nombre, a.area
    `, [id]),

    db.query(`
      SELECT
        c.empresa_id,
        COUNT(c.id)                  AS chats,
        COUNT(DISTINCT c.usuario_id) AS clientes,
        ROUND(
          (
            COUNT(cal.id) FILTER (WHERE cal.puntuacion='Bien')    * 3 +
            COUNT(cal.id) FILTER (WHERE cal.puntuacion='Regular') * 2 +
            COUNT(cal.id) FILTER (WHERE cal.puntuacion='Mal')     * 1
          ) * 100.0 / NULLIF(COUNT(cal.id) FILTER (WHERE cal.puntuacion IN ('Bien','Regular','Mal')) * 3, 0),
          0
        ) AS satisfaccion_pct
      FROM conversaciones c
      LEFT JOIN calificaciones cal ON cal.conversacion_id=c.id AND cal.tipo='agente'
      WHERE c.agente_id=$1
      GROUP BY c.empresa_id
      ORDER BY chats DESC
    `, [id]),

    db.query(`
      SELECT
        COALESCE(c.departamento, 'Sin área') AS area,
        COUNT(c.id) AS chats,
        ROUND(
          (
            COUNT(cal.id) FILTER (WHERE cal.puntuacion='Bien')    * 3 +
            COUNT(cal.id) FILTER (WHERE cal.puntuacion='Regular') * 2 +
            COUNT(cal.id) FILTER (WHERE cal.puntuacion='Mal')     * 1
          ) * 100.0 / NULLIF(COUNT(cal.id) FILTER (WHERE cal.puntuacion IN ('Bien','Regular','Mal')) * 3, 0),
          0
        ) AS satisfaccion_pct
      FROM conversaciones c
      LEFT JOIN calificaciones cal ON cal.conversacion_id=c.id AND cal.tipo='agente'
      WHERE c.agente_id=$1
      GROUP BY c.departamento
      ORDER BY chats DESC
    `, [id]),

    db.query(`
      SELECT
        TO_CHAR(c.updated_at AT TIME ZONE 'America/Mexico_City', 'DD/MM') AS dia,
        (c.updated_at AT TIME ZONE 'America/Mexico_City')::date            AS fecha,
        COUNT(*) AS chats
      FROM conversaciones c
      WHERE c.agente_id=$1
        AND (c.updated_at AT TIME ZONE 'America/Mexico_City')::date >= (NOW() AT TIME ZONE 'America/Mexico_City')::date - 29
      GROUP BY dia, fecha
      ORDER BY fecha ASC
    `, [id]),

  ]);

  return {
    resumen:    resumen.rows[0]  || null,
    porEmpresa: porEmpresa.rows,
    porArea:    porArea.rows,
    actividad:  actividad.rows,
  };
}

/**
 * Lista conversaciones cerradas con su nota/categoría de cierre.
 * Filtra por área cuando el solicitante es coordinador (no admin).
 *
 * @param {object} opts
 * @param {number}  opts.solicitante_id  - PK del agente que pide los datos.
 * @param {string}  [opts.empresa_id]    - Filtro de empresa.
 * @param {string}  [opts.area]          - Filtro de área específica (solo admin).
 * @param {number}  [opts.filtro_agente] - Filtro por agente específico.
 * @param {string}  [opts.desde]         - Fecha inicio ISO (YYYY-MM-DD).
 * @param {string}  [opts.hasta]         - Fecha fin ISO (YYYY-MM-DD).
 * @param {string}  [opts.q]             - Búsqueda libre (cliente o nota).
 * @param {number}  [opts.page=1]        - Página.
 * @param {number}  [opts.limit=50]      - Resultados por página.
 */
async function getSolucionesStaff({ solicitante_id, empresa_id, area, filtro_agente, desde, hasta, q, page = 1, limit = 50 }) {
  // Determinar rol del solicitante
  let esAdmin       = false;
  let esCoordinador = false;
  let areasCoordinadas = [];

  if (solicitante_id) {
    const { rows: aRow } = await agenteRepo.findById(solicitante_id);
    esAdmin = aRow[0]?.rol === 'admin';

    if (!esAdmin) {
      const { rows: coordRows } = await db.query(
        'SELECT nombre_area FROM public.areas_soluciones WHERE coordinador_id = $1',
        [solicitante_id]
      );
      areasCoordinadas = coordRows.map(r => r.nombre_area);
      esCoordinador = areasCoordinadas.length > 0;
    }
  }

  // Asesor regular: solo ve sus propios cierres (se fuerza filtro_agente a su propio id)
  const esAsesorSimple = !esAdmin && !esCoordinador;
  if (esAsesorSimple) {
    filtro_agente = solicitante_id; // override: solo sus propias conversaciones
  }

  // Construir cláusulas WHERE dinámicamente
  const params  = [];
  const clauses = [`c.cerrado_en IS NOT NULL`];

  // Filtro empresa
  if (empresa_id && empresa_id !== 'todas') {
    params.push(empresa_id);
    clauses.push(`c.empresa_id = $${params.length}`);
  }

  // Filtro de área: coordinador solo ve sus áreas; admin puede filtrar por área opcional. Asesor ve las suyas de cualquier área.
  if (esCoordinador) {
    const ph = areasCoordinadas.map((_, i) => `$${params.length + i + 1}`).join(', ');
    params.push(...areasCoordinadas);
    clauses.push(`c.departamento IN (${ph})`);
  } else if (esAdmin && area) {
    params.push(area);
    clauses.push(`c.departamento = $${params.length}`);
  }

  // Filtro agente específico
  if (filtro_agente) {
    params.push(filtro_agente);
    clauses.push(`a.id = $${params.length}`);
  }

  // Filtro fechas
  if (desde) {
    params.push(desde);
    clauses.push(`(c.cerrado_en AT TIME ZONE 'America/Mexico_City')::date >= $${params.length}::date`);
  }
  if (hasta) {
    params.push(hasta);
    clauses.push(`(c.cerrado_en AT TIME ZONE 'America/Mexico_City')::date <= $${params.length}::date`);
  }

  // Búsqueda libre
  if (q) {
    params.push(`%${q}%`);
    clauses.push(`(u.nombre ILIKE $${params.length} OR u.telefono ILIKE $${params.length} OR c.comentario_cierre ILIKE $${params.length} OR cat.nombre ILIKE $${params.length})`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  // Contar total para paginación
  const countResult = await db.query(`
    SELECT COUNT(*) AS total
    FROM conversaciones c
    LEFT JOIN agentes a  ON c.agente_id   = a.id
    LEFT JOIN usuarios u ON c.usuario_id  = u.id
    LEFT JOIN categoria_cierre cat ON c.categoria_cierre_id = cat.id
    ${where}
  `, params);

  const total = parseInt(countResult.rows[0]?.total || 0);

  // Paginación
  const offset = (page - 1) * limit;
  params.push(limit, offset);

  const { rows } = await db.query(`
    SELECT
      c.id,
      c.empresa_id,
      c.departamento   AS area,
      c.cerrado_en,
      c.cerrado_por    AS cerrado_por_nombre,
      c.comentario_cierre,
      c.tipo_cierre,
      cat.nombre       AS categoria_cierre,
      cat.color        AS categoria_color,
      a.id             AS agente_id,
      a.nombre         AS agente_nombre,
      a.foto_perfil    AS agente_foto,
      u.nombre         AS cliente_nombre,
      u.telefono       AS cliente_telefono
    FROM conversaciones c
    LEFT JOIN agentes a        ON c.agente_id         = a.id
    LEFT JOIN usuarios u       ON c.usuario_id        = u.id
    LEFT JOIN categoria_cierre cat ON c.categoria_cierre_id = cat.id
    ${where}
    ORDER BY c.cerrado_en DESC NULLS LAST
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);

  return { rows, total, page, limit };
}

module.exports = { getKpis, getCalificaciones, getAgenteStats, getNpsStats, getSolucionesStaff };
