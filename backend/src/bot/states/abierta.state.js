/**
 * @file abierta.state.js
 * @description Manejador del estado inicial ("inicio" / "abierta").
 *
 * Muestra el saludo personalizado con el nombre del cliente y el menú
 * de áreas (o de empresas si el bot es genérico / multi-empresa).
 */

const NOMBRES_EMPRESA = {
  fibratec:   'Fibratec',
  compusemmm: 'Compusemmm de México',
};

const MENU_AREAS = `1️⃣  Ventas — Planes, promociones y contrataciones
2️⃣  Cobranza — Pagos, facturas y estados de cuenta
3️⃣  Soporte Técnico — Fallas, velocidad y configuración

Escribe el número de tu elección.`;

/**
 * @param {string}  _mensaje
 * @param {object}  conversacion
 * @param {object}  usuario               - Se usa el nombre para personalizar el saludo.
 * @param {*}       _io
 * @param {boolean} empresaPreconfigurada - true si el bot ya sabe a qué empresa pertenece.
 * @returns {{ respuesta: string, nuevoEstado: string }}
 */
function handle(_mensaje, conversacion, usuario, _io, empresaPreconfigurada) {
  const nombre = (usuario?.nombre || 'cliente').split(' ')[0];

  if (empresaPreconfigurada) {
    const empresa = NOMBRES_EMPRESA[conversacion.empresa_id] || conversacion.empresa_id;
    return {
      respuesta: `👋 ¡Hola, ${nombre}! Bienvenido/a al servicio de atención de ${empresa}.\n\n¿Con qué área podemos ayudarte hoy?\n\n${MENU_AREAS}`,
      nuevoEstado: 'SELECCION_AREA',
    };
  }

  return {
    respuesta: `👋 ¡Hola, ${nombre}! Bienvenido/a.\n\n¿A cuál de nuestras empresas deseas comunicarte?\n\n1️⃣  Fibratec\n2️⃣  Compusemmm de México\n\nEscribe el número de tu elección.`,
    nuevoEstado: 'SELECCION_EMPRESA',
  };
}

module.exports = { handle };
