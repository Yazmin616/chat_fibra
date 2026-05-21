/**
 * @file ecosystem.config.js
 * @description Configuración de PM2 para gestión del proceso en producción.
 *
 * Uso:
 *   pm2 start ecosystem.config.js          # Arrancar
 *   pm2 restart isp-chatbot-api            # Reiniciar
 *   pm2 logs isp-chatbot-api               # Ver logs
 *   pm2 save                               # Guardar lista de procesos
 *   pm2 startup                            # Arranque automático al reiniciar el servidor
 *
 * PM2 reiniciará el proceso automáticamente si crashea.
 * En cluster_mode usa todos los cores disponibles para mayor rendimiento.
 */

module.exports = {
  apps: [
    {
      name:         'isp-chatbot-api',
      script:       'src/index.js',
      cwd:          __dirname,
      instances:    1,           // Socket.io necesita sticky sessions para > 1 instancia
      exec_mode:    'fork',
      watch:        false,
      autorestart:  true,
      max_restarts: 10,
      restart_delay: 3000,

      env: {
        NODE_ENV: 'development',
      },

      env_production: {
        NODE_ENV: 'production',
      },

      error_file: 'logs/pm2-error.log',
      out_file:   'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
