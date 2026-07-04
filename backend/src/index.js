/**
 * @file index.js
 * @description Punto de entrada del servidor backend.
 *
 * Responsabilidades:
 *   1. Cargar variables de entorno desde .env
 *   2. Configurar Express (Helmet, CORS restringido, JSON)
 *   3. Crear el servidor HTTP + Socket.io
 *   4. Registrar todas las rutas
 *   5. Registrar el errorHandler global
 *   6. Arrancar el servidor y los servicios en segundo plano (Telegram, auto-cierre)
 *
 * La instancia de Socket.io (`io`) se almacena en `app.set('io', io)` para que
 * los controllers puedan acceder a ella via `req.app.get('io')` sin acoplamiento global.
 */

require('dotenv').config();
const path        = require('path');
const fs          = require('fs');
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const http        = require('http');
const { Server }  = require('socket.io');

const rateLimit            = require('express-rate-limit');
const logger               = require('./config/logger');
const { runMigrations }    = require('./config/runMigrations');
const { iniciarTelegram }  = require('./adapters/telegram');
const { iniciarMeta }      = require('./adapters/meta');
const { iniciarAutoCierre } = require('./services/autoClose.service');
const errorHandler         = require('./middleware/errorHandler.middleware');
const maintenance          = require('./maintenance');

// Rutas
const authRoutes             = require('./routes/auth.routes');
const agenteRoutes           = require('./routes/agente.routes');
const conversacionesRoutes   = require('./routes/conversaciones.routes');
const configuracionRoutes    = require('./routes/configuracion.routes');
const contactosRoutes        = require('./routes/contactos.routes');
const tiRoutes               = require('./routes/ti.routes');
const horariosRoutes         = require('./routes/horarios.routes');
const transferenciaRoutes    = require('./routes/transferencia.routes');
const etiquetaRoutes         = require('./routes/etiqueta.routes');
const categoriaCierreRoutes  = require('./routes/categoriaCierre.routes');
const permisosRoutes         = require('./routes/permisos.routes');
const rolTemplateRoutes      = require('./routes/rolTemplate.routes');
const palabrasClaveRoutes    = require('./routes/palabrasClave.routes');
const flujoRoutes            = require('./routes/flujo.routes');

const app    = express();
const server = http.createServer(app);

// DEBUG TEMPORAL — registrado ANTES que helmet/cors para capturar cualquier petición
// independientemente de si un middleware posterior la rechaza.
app.use('/meta/webhook', (req, res, next) => {
  logger.info('[META EARLIEST] method=' + req.method
    + ' content-type=' + (req.headers['content-type'] || 'none')
    + ' signature=' + (req.headers['x-hub-signature-256'] ? 'present' : 'ABSENT')
    + ' origin=' + (req.headers['origin'] || 'none')
  );
  next();
});

// Confiar en el primer proxy (ngrok en dev, nginx en producción).
// Necesario para que express-rate-limit lea X-Forwarded-For correctamente.
app.set('trust proxy', 1);

// Acepta localhost y cualquier IP de red privada (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

const FRONTEND_URL = process.env.FRONTEND_URL || '';

const corsOrigin = (origin, callback) => {
  // Sin origin: peticiones del mismo servidor o herramientas como curl
  if (!origin) return callback(null, true);
  // Redes locales siempre permitidas
  if (LOCAL_ORIGIN.test(origin)) return callback(null, true);
  // URL de frontend configurada en .env (producción/staging)
  if (FRONTEND_URL && origin === FRONTEND_URL) return callback(null, true);
  callback(new Error(`Origen no permitido: ${origin}`));
};

// Socket.io con CORS restringido al frontend
const io = new Server(server, {
  cors: {
    origin:      corsOrigin,
    methods:     ['GET', 'POST'],
    credentials: true,
  },
});

// ── Rate limiters ────────────────────────────────────────────────────────────
// Se definen antes de cualquier app.use() para poder usarlos en el orden correcto.

// API REST: protege contra brute-force y abuso general.
const apiLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             200,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' },
});

// Webhooks (Telegram, Meta): más permisivo porque el tráfico viene de sus servidores.
// La validación de firma es la protección principal; este limiter es defensa adicional.
const webhookLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             600,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Límite de webhook excedido.' },
});

// ── Middleware global ─────────────────────────────────────────────────────────

// Helmet: cabeceras HTTP de seguridad (X-Frame-Options, X-Content-Type, HSTS, etc.)
app.use(helmet());

// CORS restringido a redes locales + FRONTEND_URL del .env
app.use(cors({
  origin:      corsOrigin,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true,
}));

// Webhook de Meta: rate limiting + raw body para validar HMAC-SHA256.
// El raw body debe ir ANTES del json() global para tener precedencia en esa ruta.
app.use('/meta/webhook', webhookLimiter);
app.use('/meta/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

// Servir archivos subidos (avatares, etc.) con CORP permisivo para que los
// navegadores puedan cargar las imágenes desde el mismo origen o rutas de red.
const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(path.join(uploadsDir, 'avatars'),   { recursive: true });
fs.mkdirSync(path.join(uploadsDir, 'rr-media'),  { recursive: true });
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
}));

// Compartir io con todos los controllers via req.app.get('io')
app.set('io', io);

// Middleware global de modo mantenimiento.
// Bloquea rutas operativas de agentes, pero deja pasar webhooks (clientes siguen atendidos).
app.use((req, res, next) => {
  if (!maintenance.isActive()) return next();
  const libre = req.path === '/auth/login'
             || req.path === '/'
             || req.path === '/health'
             || req.path.startsWith('/ti/')
             || req.path.startsWith('/meta/webhook'); // webhooks siguen vivos durante mantenimiento
  if (libre) return next();
  res.status(503).json({ error: 'Sistema en mantenimiento. Por favor espere.', mantenimiento: true });
});

// Eventos de conexión Socket.io
io.on('connection', (socket) => {
  logger.info('Cliente conectado', { socketId: socket.id });

  // El agente emite este evento al iniciar sesión para unirse a su sala
  socket.on('agente:join', ({ rol, area, id }) => {
    if (id) {
      socket.agenteId = id;
      require('./services/pollingService').setAgentOnline(id);
    }
    if (rol === 'admin') {
      socket.join('admin');
    } else if (area) {
      socket.join(`area:${area}`);
    }
    logger.info(`Socket ${socket.id} joined room: ${rol === 'admin' ? 'admin' : 'area:' + area}`);
  });

  socket.on('disconnect', () => {
    if (socket.agenteId) {
      require('./services/pollingService').setAgentOffline(socket.agenteId);
    }
    logger.info('Cliente desconectado', { socketId: socket.id });
  });
});

// Rutas de la API (con rate limiting por IP)
app.use('/auth',             apiLimiter, authRoutes);
app.use('/ti',               tiRoutes);
app.use('/agente',           apiLimiter, agenteRoutes);
app.use('/conversaciones',   apiLimiter, conversacionesRoutes);
app.use('/configuracion',    apiLimiter, configuracionRoutes);
app.use('/contactos',        apiLimiter, contactosRoutes);
app.use('/horarios',         apiLimiter, horariosRoutes);
app.use('/transferencias',   apiLimiter, transferenciaRoutes);
app.use('/etiquetas',        apiLimiter, etiquetaRoutes);
app.use('/categorias-cierre', apiLimiter, categoriaCierreRoutes);
app.use('/permisos',         apiLimiter, permisosRoutes);
app.use('/rol-template',     apiLimiter, rolTemplateRoutes);
app.use('/palabras-clave',   apiLimiter, palabrasClaveRoutes);
app.use('/flujos',           apiLimiter, flujoRoutes);
// Los webhooks de Telegram usan el webhookLimiter; Meta se registra en iniciarMeta()
app.use('/telegram',       webhookLimiter);

// Health checks
app.get('/',       (req, res) => res.send('API funcionando'));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Módulo Polling Interno
require('./services/pollingService').setupPollingEndpoint(app);

// Middleware global de errores (debe ir DESPUÉS de todas las rutas)
app.use(errorHandler);

// Arrancar servidor — las migraciones se aplican antes de abrir el puerto.
// Para correr migraciones manualmente: npm run migrate
const PORT = process.env.PORT || 3009;
runMigrations()
  .then(() => server.listen(PORT, () => {
    logger.info(`Servidor corriendo en puerto ${PORT}`, { env: process.env.NODE_ENV || 'development' });
    iniciarTelegram(io, app); // Escuchar mensajes de Telegram (polling o webhook según .env)
    iniciarMeta(app, io);     // Registrar webhook de WhatsApp / Facebook / Instagram
    iniciarAutoCierre(io);    // Timer de cierre por inactividad
  }))
  .catch(err => {
    logger.error('Error al aplicar migraciones:', { error: err.message });
    process.exit(1);
  });
