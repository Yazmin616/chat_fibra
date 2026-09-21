/**
 * @file auth.routes.js
 * @description Rutas de autenticación de agentes.
 *
 * Rutas expuestas:
 *   POST /auth/login   → Autentica y devuelve token JWT (con rate limiting: 10 req / 15 min)
 *   POST /auth/logout  → Marca al agente como offline (requiere token válido)
 */

const express        = require('express');
const rateLimit      = require('express-rate-limit');
const router         = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');

/** Protección de fuerza bruta: máximo 60 intentos de login por IP cada 15 minutos. */
const loginLimiter = rateLimit({
  windowMs:   15 * 60 * 1000,
  max:        60,
  standardHeaders: true,
  legacyHeaders:   false,
  message:    { error: 'Demasiados intentos de inicio de sesión. Espera 15 minutos e intenta de nuevo.' },
});

router.post('/login',                          loginLimiter, authController.login);
router.post('/logout',                         verifyToken,  authController.logout);
router.post('/heartbeat',                      verifyToken,  authController.heartbeat);
router.post('/cambiar-password-obligatorio',   verifyToken,  authController.cambiarPasswordObligatorio);
router.post('/consultar-coordinador',          loginLimiter, authController.consultarCoordinador);
router.post('/solicitar-recuperacion',         loginLimiter, authController.solicitarRecuperacionPassword);
router.get ('/canales-status',                               authController.canalesStatus);

module.exports = router;
