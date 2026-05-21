/**
 * @file auth.middleware.js
 * @description Middlewares de autenticación y autorización basados en JWT.
 *
 * Uso en rutas protegidas:
 *   router.get('/ruta', verifyToken, requireAdmin, handler)
 *   router.get('/ruta', verifyToken, requireAsesor, handler)
 *
 * Si el token es válido, adjunta los datos del agente a `req.agente`:
 *   { id, nombre, rol, area }
 *
 * Nota: en la versión actual las rutas del dashboard NO tienen verifyToken
 * aplicado (se omitió por simplicidad en el desarrollo). En producción se
 * recomienda proteger todas las rutas sensibles.
 */

const jwt        = require('jsonwebtoken');
const agenteRepo = require('../repositories/agente.repository');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET no está configurado en .env');

/**
 * Verifica que la petición incluya un token JWT válido en el header Authorization.
 * Formato esperado: `Authorization: Bearer <token>`
 *
 * Si el token es válido, agrega `req.agente` con los datos del agente.
 * Si no hay token o es inválido/expirado, responde 401.
 *
 * @param {import('express').Request}      req
 * @param {import('express').Response}     res
 * @param {import('express').NextFunction} next
 */
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    req.agente = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    // Token expirado: decodificamos sin verificar para saber qué agente era
    // y lo marcamos offline automáticamente — sin necesidad de que el agente
    // presione "cerrar sesión" manualmente.
    if (err.name === 'TokenExpiredError') {
      try {
        const decoded = jwt.decode(token);
        if (decoded?.id) await agenteRepo.setOnline(decoded.id, false);
      } catch (_) { /* silencioso — no bloquear la respuesta */ }
    }
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Verifica que el agente autenticado tenga rol "admin".
 * Debe usarse siempre DESPUÉS de verifyToken.
 * Si no es admin, responde 403.
 *
 * @param {import('express').Request}      req
 * @param {import('express').Response}     res
 * @param {import('express').NextFunction} next
 */
const requireAdmin = (req, res, next) => {
  if (!req.agente || req.agente.rol !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * Verifica que el agente autenticado tenga rol "asesor" o "admin".
 * Debe usarse siempre DESPUÉS de verifyToken.
 * Si no tiene ninguno de esos roles, responde 403.
 *
 * @param {import('express').Request}      req
 * @param {import('express').Response}     res
 * @param {import('express').NextFunction} next
 */
const requireAsesor = (req, res, next) => {
  if (!req.agente || (req.agente.rol !== 'asesor' && req.agente.rol !== 'admin')) {
    return res.status(403).json({ error: 'Asesor access required' });
  }
  next();
};

/**
 * Verifica que el agente autenticado tenga rol "ti".
 * Solo el rol TI accede al panel de mantenimiento.
 */
const requireTI = (req, res, next) => {
  if (!req.agente || req.agente.rol !== 'ti') {
    return res.status(403).json({ error: 'TI access required' });
  }
  next();
};

module.exports = { verifyToken, requireAdmin, requireAsesor, requireTI };
