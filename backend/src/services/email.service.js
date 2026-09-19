/**
 * @file email.service.js
 * @description Servicio para envío de correos institucionales (recuperación de contraseñas, alertas).
 * Utiliza nodemailer con soporte para SMTP configurable vía variables de entorno.
 */

const logger = require('../config/logger');

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  logger.warn('[EMAIL] nodemailer aún no instalado en entorno local, usando fallback');
}

/**
 * Crea o retorna el transportador SMTP basado en variables de entorno.
 */
function getTransporter() {
  if (!nodemailer) return null;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false
    }
  });
}

/**
 * Envía un correo con la contraseña temporal institucional.
 * @param {string} destinatario - Correo destino.
 * @param {string} nombre - Nombre del colaborador.
 * @param {string} passwordTemporal - Contraseña temporal generada.
 */
async function enviarPasswordTemporal(destinatario, nombre, passwordTemporal) {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'soporte@fibratec.mx';

  if (!transporter) {
    logger.info(`[EMAIL SIMULADO] Clave temporal para ${nombre} (${destinatario}): ${passwordTemporal}`);
    return {
      enviado: false,
      simulado: true,
      mensaje: 'Servidor SMTP no configurado en .env. Clave temporal registrada en logs del servidor.'
    };
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
      <div style="background-color: #dc2626; color: #ffffff; padding: 20px; text-align: center;">
        <h2 style="margin: 0; font-size: 1.3rem;">Recuperación de Contraseña</h2>
        <p style="margin: 5px 0 0 0; font-size: 0.85rem; opacity: 0.9;">Fibratec · Compusemmm de México</p>
      </div>
      <div style="padding: 24px; background-color: #ffffff; color: #334155; line-height: 1.6;">
        <p>Hola <strong>${nombre}</strong>,</p>
        <p>Se ha solicitado la recuperación de tu contraseña de acceso al sistema.</p>
        <p>Tu contraseña temporal de acceso es:</p>
        <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 14px; text-align: center; margin: 20px 0;">
          <span style="font-size: 1.4rem; font-weight: bold; letter-spacing: 2px; color: #0f172a;">${passwordTemporal}</span>
        </div>
        <p style="font-size: 0.85rem; color: #64748b;">
          <strong>Nota de seguridad:</strong> Al ingresar con esta clave temporal, el sistema te solicitará obligatoriamente registrar tu nueva contraseña definitiva.
        </p>
        <p style="font-size: 0.85rem; color: #94a3b8; margin-top: 24px;">
          Si tú no solicitaste este cambio, repórtalo inmediatamente al área de TI.
        </p>
      </div>
      <div style="background-color: #f1f5f9; padding: 12px; text-align: center; font-size: 0.75rem; color: #64748b;">
        © 2026 Fibratec CRM · Todos los derechos reservados
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Soporte y Seguridad Fibratec" <${from}>`,
    to: destinatario,
    subject: 'Recuperación de Contraseña - Fibratec CRM',
    html
  });

  logger.info(`[EMAIL] Correo de recuperación enviado exitosamente a ${destinatario}`);
  return { enviado: true, simulado: false };
}

module.exports = {
  enviarPasswordTemporal
};
