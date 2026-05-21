/**
 * @file logger.js
 * @description Logger centralizado basado en Winston.
 * Reemplaza los console.log/error dispersos para tener logs estructurados
 * con timestamp, nivel y formato consistente.
 *
 * En desarrollo: formato legible en consola con colores.
 * En producción:  JSON puro para integrar con herramientas de observabilidad (Datadog, Loggly, etc.).
 *
 * Uso:
 *   const logger = require('./config/logger');
 *   logger.info('Servidor iniciado en puerto 3009');
 *   logger.error('Fallo en DB', { error: err.message });
 *   logger.warn('Token JWT próximo a expirar');
 */

const { createLogger, format, transports } = require('winston');

const isProd = process.env.NODE_ENV === 'production';

const logger = createLogger({
  level: isProd ? 'warn' : 'info',

  format: isProd
    ? format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      )
    : format.combine(
        format.colorize(),
        format.timestamp({ format: 'HH:mm:ss' }),
        format.printf(({ timestamp, level, message, ...meta }) => {
          const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
          return `${timestamp} [${level}] ${message}${extra}`;
        })
      ),

  transports: [
    new transports.Console(),
    ...(isProd
      ? [new transports.File({ filename: 'logs/error.log', level: 'error' }),
         new transports.File({ filename: 'logs/combined.log' })]
      : [])
  ],
});

module.exports = logger;
