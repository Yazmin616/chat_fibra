/**
 * @file logBuffer.js
 * @description Buffer en memoria de los últimos 300 logs del servidor.
 * Expone un Transport de Winston que puede agregarse al logger,
 * y una función getLogs() para que el panel TI los consulte via HTTP.
 */

const { transports: { Console: _C }, createLogger } = require('winston'); // solo para typeof check
const TransportBase = require('winston-transport');

const entries = [];
const MAX = 300;

class MemoryTransport extends TransportBase {
  log(info, callback) {
    entries.unshift({
      ts:      info.timestamp || new Date().toISOString(),
      level:   info.level,
      message: typeof info.message === 'string' ? info.message : JSON.stringify(info.message),
    });
    if (entries.length > MAX) entries.pop();
    this.emit('logged', info);
    callback();
  }
}

/**
 * Devuelve los últimos `n` registros de log (más recientes primero).
 * @param {number} [n=100]
 */
const getLogs = (n = 100) => entries.slice(0, Math.min(n, MAX));

module.exports = { MemoryTransport, getLogs };
