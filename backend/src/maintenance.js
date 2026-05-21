/**
 * @file maintenance.js
 * @description Estado global de modo mantenimiento.
 * Módulo singleton: todos los archivos que lo requieran comparten la misma instancia.
 * El estado vive en memoria — se resetea a false al reiniciar el servidor.
 */

let _active = false;

module.exports = {
  isActive:   ()  => _active,
  activate:   ()  => { _active = true;  },
  deactivate: ()  => { _active = false; },
};
