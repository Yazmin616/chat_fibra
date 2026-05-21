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
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const http        = require('http');
const { Server }  = require('socket.io');
const db          = require('./config/db');

const logger               = require('./config/logger');
const { iniciarTelegram }  = require('./adapters/telegram');
const { iniciarMeta }      = require('./adapters/meta');
const { iniciarAutoCierre } = require('./services/autoClose.service');
const errorHandler         = require('./middleware/errorHandler.middleware');

// Rutas
const authRoutes           = require('./routes/auth.routes');
const agenteRoutes         = require('./routes/agente.routes');
const conversacionesRoutes = require('./routes/conversaciones.routes');
const configuracionRoutes  = require('./routes/configuracion.routes');
const contactosRoutes      = require('./routes/contactos.routes');

const app    = express();
const server = http.createServer(app);

// Acepta localhost y cualquier IP de red privada (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

const corsOrigin = (origin, callback) => {
  // Sin origin: peticiones del mismo servidor o herramientas como curl
  if (!origin || LOCAL_ORIGIN.test(origin)) return callback(null, true);
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

// Helmet: cabeceras HTTP de seguridad (X-Frame-Options, X-Content-Type, HSTS, etc.)
app.use(helmet());

// CORS restringido a redes locales
app.use(cors({
  origin:      corsOrigin,
  methods:     ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

app.use(express.json());

// Compartir io con todos los controllers via req.app.get('io')
app.set('io', io);

// Eventos de conexión Socket.io
io.on('connection', (socket) => {
  logger.info('Cliente conectado', { socketId: socket.id });

  // El agente emite este evento al iniciar sesión para unirse a su sala
  socket.on('agente:join', ({ rol, area }) => {
    if (rol === 'admin') {
      socket.join('admin');
    } else if (area) {
      socket.join(`area:${area}`);
    }
    logger.info(`Socket ${socket.id} joined room: ${rol === 'admin' ? 'admin' : 'area:' + area}`);
  });

  socket.on('disconnect', () => logger.info('Cliente desconectado', { socketId: socket.id }));
});

// Rutas de la API
app.use('/auth',           authRoutes);
app.use('/agente',         agenteRoutes);
app.use('/conversaciones', conversacionesRoutes);
app.use('/configuracion',  configuracionRoutes);
app.use('/contactos',      contactosRoutes);

// Health checks
app.get('/',       (req, res) => res.send('API funcionando'));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Middleware global de errores (debe ir DESPUÉS de todas las rutas)
app.use(errorHandler);

// Crear tabla de infracciones si no existe
async function initDb() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS infracciones (
      id              SERIAL PRIMARY KEY,
      conversacion_id INT REFERENCES conversaciones(id) ON DELETE CASCADE,
      empresa_id      VARCHAR NOT NULL,
      departamento    VARCHAR,
      cliente_nombre  VARCHAR,
      tiempo_espera   INT NOT NULL,
      tipo            VARCHAR NOT NULL DEFAULT 'area',
      agente_id       INT REFERENCES agentes(id) ON DELETE SET NULL,
      agente_nombre   VARCHAR,
      created_at      TIMESTAMP DEFAULT NOW()
    )
  `);
  // Agregar columnas nuevas si la tabla ya existía sin ellas
  await db.query(`ALTER TABLE infracciones ADD COLUMN IF NOT EXISTS tipo          VARCHAR NOT NULL DEFAULT 'area'`);
  await db.query(`ALTER TABLE infracciones ADD COLUMN IF NOT EXISTS agente_id     INT REFERENCES agentes(id) ON DELETE SET NULL`);
  await db.query(`ALTER TABLE infracciones ADD COLUMN IF NOT EXISTS agente_nombre VARCHAR`);
  logger.info('DB: tabla infracciones verificada.');
}

// Arrancar servidor
const PORT = process.env.PORT || 3009;
initDb()
  .then(() => server.listen(PORT, () => {
    logger.info(`Servidor corriendo en puerto ${PORT}`, { env: process.env.NODE_ENV || 'development' });
    iniciarTelegram(io);   // Escuchar mensajes de Telegram
    iniciarMeta(app, io);  // Registrar webhook de WhatsApp / Facebook / Instagram
    iniciarAutoCierre(io); // Timer de cierre por inactividad
  }))
  .catch(err => {
    logger.error('Error al inicializar DB:', { error: err.message });
    process.exit(1);
  });
