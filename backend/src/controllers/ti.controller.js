/**
 * @file ti.controller.js
 * @description Controlador para el panel de TI.
 * Solo accesible con rol "ti". Gestiona:
 *   - Estado del sistema (conteos, tamaño BD)
 *   - Modo mantenimiento (on/off)
 *   - Respaldo de base de datos (JSON descargable)
 *   - Purga de mensajes antiguos
 *   - Logs del servidor (buffer en memoria)
 */

const path        = require('path');
const fs          = require('fs');
const db          = require('../config/db');
const maintenance = require('../maintenance');
const { getLogs } = require('../logBuffer');
const logger      = require('../config/logger');

const STICKERS_DIR = path.join(__dirname, '../../uploads/stickers');

// ── Estado del sistema ───────────────────────────────────────────────────────

const getStatus = async (req, res, next) => {
  try {
    const [counts, dbSize, mesesPreview] = await Promise.all([

      db.query(`
        SELECT
          (SELECT COUNT(*) FROM mensajes)       AS mensajes,
          (SELECT COUNT(*) FROM conversaciones) AS conversaciones,
          (SELECT COUNT(*) FROM calificaciones) AS calificaciones,
          (SELECT COUNT(*) FROM agentes WHERE rol != 'ti') AS agentes,
          (SELECT COUNT(*) FROM usuarios)       AS usuarios
      `),

      db.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) AS size,
               pg_database_size(current_database()) AS bytes
      `),

      db.query(`
        SELECT COUNT(*) AS elegibles
        FROM mensajes
        WHERE conversacion_id IN (
          SELECT id FROM conversaciones
          WHERE estado IN ('cerrada','ENCUESTA_AGENTE','ENCUESTA_BOT')
            AND updated_at < NOW() - INTERVAL '6 months'
        )
      `),
    ]);

    res.json({
      mantenimiento: maintenance.isActive(),
      counts:        counts.rows[0],
      db:            dbSize.rows[0],
      purgaElegibles: parseInt(mesesPreview.rows[0].elegibles),
    });
  } catch (err) { next(err); }
};

// ── Modo mantenimiento ───────────────────────────────────────────────────────

const setMantenimiento = (req, res) => {
  const { activo } = req.body;
  if (activo) {
    maintenance.activate();
    logger.warn('[TI] Modo mantenimiento ACTIVADO');
  } else {
    maintenance.deactivate();
    logger.info('[TI] Modo mantenimiento DESACTIVADO');
  }
  const io = req.app.get('io');
  if (io) io.emit('sistema:mantenimiento', { activo: maintenance.isActive() });
  res.json({ ok: true, mantenimiento: maintenance.isActive() });
};

// ── Respaldo ─────────────────────────────────────────────────────────────────

const descargarBackup = async (req, res, next) => {
  try {
    logger.info('[TI] Generando respaldo de base de datos...');

    const [agentes, usuarios, conversaciones, mensajes, calificaciones,
           configuraciones, empresas, infracciones] = await Promise.all([
      db.query('SELECT id,nombre,email,rol,area,esta_online,created_at FROM agentes ORDER BY id'),
      db.query('SELECT * FROM usuarios ORDER BY id'),
      db.query('SELECT * FROM conversaciones ORDER BY id'),
      db.query('SELECT * FROM mensajes ORDER BY id'),
      db.query('SELECT * FROM calificaciones ORDER BY id'),
      db.query('SELECT * FROM configuraciones ORDER BY clave'),
      db.query('SELECT * FROM empresas ORDER BY id'),
      db.query('SELECT * FROM infracciones ORDER BY id'),
    ]);

    const backup = {
      meta: {
        version:    '1.0',
        generado:   new Date().toISOString(),
        sistema:    'ISP Chatbot CRM',
        counts: {
          agentes:         agentes.rows.length,
          usuarios:        usuarios.rows.length,
          conversaciones:  conversaciones.rows.length,
          mensajes:        mensajes.rows.length,
          calificaciones:  calificaciones.rows.length,
          configuraciones: configuraciones.rows.length,
          empresas:        empresas.rows.length,
          infracciones:    infracciones.rows.length,
        }
      },
      tablas: {
        empresas:        empresas.rows,
        agentes:         agentes.rows,
        usuarios:        usuarios.rows,
        conversaciones:  conversaciones.rows,
        mensajes:        mensajes.rows,
        calificaciones:  calificaciones.rows,
        configuraciones: configuraciones.rows,
        infracciones:    infracciones.rows,
      }
    };

    const fecha     = new Date().toISOString().slice(0, 10);
    const filename  = `backup_ispchatbot_${fecha}.json`;
    const body      = JSON.stringify(backup, null, 2);

    logger.info(`[TI] Respaldo generado: ${backup.meta.counts.mensajes} mensajes, ${backup.meta.counts.conversaciones} conversaciones`);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  } catch (err) { next(err); }
};

// ── Preview de purga ─────────────────────────────────────────────────────────

const previewPurga = async (req, res, next) => {
  try {
    const meses = Math.max(1, parseInt(req.query.meses) || 6);
    const { rows } = await db.query(`
      SELECT COUNT(*) AS elegibles
      FROM mensajes
      WHERE conversacion_id IN (
        SELECT id FROM conversaciones
        WHERE estado IN ('cerrada','ENCUESTA_AGENTE','ENCUESTA_BOT')
          AND updated_at < NOW() - ($1 || ' months')::interval
      )
    `, [meses]);
    res.json({ elegibles: parseInt(rows[0].elegibles), meses });
  } catch (err) { next(err); }
};

// ── Purgar mensajes ──────────────────────────────────────────────────────────

const purgar = async (req, res, next) => {
  try {
    const { meses = 6, confirmado } = req.body;
    if (!confirmado) {
      return res.status(400).json({ error: 'Se requiere confirmación explícita' });
    }
    const mesesNum = Math.max(1, parseInt(meses));

    const { rowCount } = await db.query(`
      DELETE FROM mensajes
      WHERE conversacion_id IN (
        SELECT id FROM conversaciones
        WHERE estado IN ('cerrada','ENCUESTA_AGENTE','ENCUESTA_BOT')
          AND updated_at < NOW() - ($1 || ' months')::interval
      )
    `, [mesesNum]);

    // VACUUM ANALYZE para recuperar espacio y actualizar estadísticas
    await db.query('VACUUM ANALYZE mensajes');

    logger.warn(`[TI] Purga completada: ${rowCount} mensajes eliminados (>${mesesNum} meses)`);
    res.json({ ok: true, eliminados: rowCount, meses: mesesNum });
  } catch (err) { next(err); }
};

// ── Limpiar base de datos ────────────────────────────────────────────────────

const limpiarBD = async (req, res, next) => {
  try {
    const { confirmado } = req.body;
    if (!confirmado) {
      return res.status(400).json({ error: 'Se requiere confirmación explícita' });
    }

    await db.query(`
      TRUNCATE TABLE mensajes, calificaciones, infracciones, conversaciones, usuarios
      RESTART IDENTITY CASCADE
    `);

    logger.warn('[TI] Base de datos limpiada: mensajes, conversaciones, calificaciones, infracciones y usuarios eliminados');
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ── Logs ─────────────────────────────────────────────────────────────────────

const obtenerLogs = (req, res) => {
  const n = Math.min(parseInt(req.query.n) || 100, 300);
  res.json({ logs: getLogs(n) });
};

// ── Gestión de stickers ─────────────────────────────────────────────────────

const listarStickers = async (req, res, next) => {
  try {
    let entries;
    try { entries = await fs.promises.readdir(STICKERS_DIR, { withFileTypes: true }); }
    catch { return res.json([]); }

    // Conteo de favoritos + mapa de nombre de agente para packs personales
    const [favRes, agentesRes] = await Promise.all([
      db.query('SELECT pack, file, COUNT(*)::int AS count FROM sticker_favoritos GROUP BY pack, file'),
      db.query("SELECT id, nombre FROM agentes WHERE rol != 'ti'"),
    ]);
    const favMap    = {};
    for (const r of favRes.rows) favMap[`${r.pack}/${r.file}`] = r.count;
    const agenteMap = {};
    for (const a of agentesRes.rows) agenteMap[`agente_${a.id}`] = a.nombre;

    const packs = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const dirPath  = path.join(STICKERS_DIR, e.name);
      const files    = (await fs.promises.readdir(dirPath))
        .filter(f => /\.(webp|png|gif)$/i.test(f))
        .sort()
        .map(f => ({ file: f, favoritos: favMap[`${e.name}/${f}`] || 0 }));
      if (!files.length) continue;
      const label = agenteMap[e.name] ? `👤 ${agenteMap[e.name]}` : e.name;
      packs.push({ pack: e.name, label, files });
    }
    res.json(packs);
  } catch (err) { next(err); }
};

const eliminarSticker = async (req, res, next) => {
  try {
    const safePack = path.basename(req.params.pack);
    const safeFile = path.basename(req.params.file);
    await fs.promises.unlink(path.join(STICKERS_DIR, safePack, safeFile));
    await db.query(
      'DELETE FROM sticker_favoritos WHERE pack=$1 AND file=$2',
      [safePack, safeFile]
    );
    logger.info(`[TI STICKER] Eliminado: ${safePack}/${safeFile}`);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Archivo no encontrado' });
    next(err);
  }
};

module.exports = { getStatus, setMantenimiento, descargarBackup, previewPurga, purgar, limpiarBD, obtenerLogs, listarStickers, eliminarSticker };
