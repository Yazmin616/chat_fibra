/**
 * @file errorHandler.middleware.js
 * @description Middleware centralizado de manejo de errores para Express.
 * Captura todos los errores propagados con next(err) en controllers y servicios,
 * y los convierte en respuestas HTTP con el formato { error: string }.
 *
 * Registrado en index.js DESPUÉS de todas las rutas:
 *   app.use(errorHandler)
 *
 * Para enviar un error con código HTTP personalizado desde un servicio:
 *   const err = new Error('Mensaje'); err.status = 404; throw err;
 */

const logger = require('../config/logger');

/**
 * Middleware de error de Express (4 parámetros: err, req, res, next).
 * Maneja casos especiales de PostgreSQL y errores genéricos.
 *
 * Códigos de error PostgreSQL manejados:
 *   23505 → Unique constraint violation (ej. email duplicado) → 400
 *   23503 → Foreign key violation (ej. referencia inválida)   → 400
 *
 * @param {Error & { status?: number, code?: string }} err
 * @param {import('express').Request}      req
 * @param {import('express').Response}     res
 * @param {import('express').NextFunction} next
 */
const errorHandler = (err, req, res, next) => {
  logger.error(`${req.method} ${req.path} — ${err.message}`, {
    status: err.status || 500,
    stack:  err.stack,
  });

  if (err.code === '23505') {
    return res.status(400).json({ error: 'El registro ya existe' });
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referencia de datos inválida' });
  }

  res.status(err.status || 500).json({
    error:  err.message || 'Error interno del servidor',
    status: err.status  || 500
  });
};

module.exports = errorHandler;
