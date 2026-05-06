require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// Adaptadores y Servicios
const { iniciarTelegram } = require('./adapters/telegram');
const { iniciarAutoCierre } = require('./services/autoClose.service');

// Rutas
const agenteRoutes = require('./routes/agente.routes');
const conversacionesRoutes = require('./routes/conversaciones.routes');
const configuracionRoutes = require('./routes/configuracion.routes');

const app = express();

/* ========================
   MIDDLEWARES
======================== */
app.use(cors());
app.use(express.json());

/* ========================
   SERVER + SOCKET.IO
======================== */
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.set('io', io);
global.io = io;

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  socket.on('disconnect', () => console.log('Cliente desconectado:', socket.id));
});

/* ========================
   ROUTES
======================== */
app.use('/agente', agenteRoutes);
app.use('/conversaciones', conversacionesRoutes);
app.use('/configuracion', configuracionRoutes);

app.get('/', (req, res) => res.send('API funcionando'));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

/* ========================
   START SERVER & SERVICES
======================== */
const PORT = process.env.PORT || 3009;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  
  // Iniciar servicios en segundo plano
  iniciarTelegram();
  iniciarAutoCierre(io);
});