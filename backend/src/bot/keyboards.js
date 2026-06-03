/**
 * @file keyboards.js
 * @description Definiciones de teclados inline de Telegram reutilizables en los states.
 * El callback_data usa los valores que los parsers ya aceptan.
 */

const AREAS = {
  inline_keyboard: [
    [{ text: '1️⃣  Ventas', callback_data: '1' }],
    [{ text: '2️⃣  Cobranza', callback_data: '2' }],
    [{ text: '3️⃣  Soporte Técnico', callback_data: '3' }],
  ],
};

const EMPRESAS = {
  inline_keyboard: [
    [{ text: '1️⃣  Fibratec', callback_data: '1' }],
    [{ text: '2️⃣  Compusemmm de México', callback_data: '2' }],
  ],
};

// parsePuntuacion: "1"→Mal, "2"→Regular, "3"→Bien
const ENCUESTA = {
  inline_keyboard: [
    [
      { text: '👍 Buena', callback_data: '3' },
      { text: '😐 Regular', callback_data: '2' },
      { text: '👎 Mala', callback_data: '1' },
    ],
  ],
};

// Nuevo cliente: ¿ya es cliente o quiere contratar?
const TIPO_CLIENTE = {
  inline_keyboard: [
    [{ text: '👤 Soy cliente', callback_data: 'soy_cliente' }],
    [{ text: '🆕 Quiero contratar', callback_data: 'contratar' }],
  ],
};

// Menú de autoservicio para clientes identificados vía WISP (incluye validar comprobante)
const AUTOSERVICIO = {
  inline_keyboard: [
    [{ text: '💰 ¿Cuánto debo?', callback_data: 'deuda' }],
    [{ text: '📍 ¿Dónde pago?', callback_data: 'pago' }],
    [{ text: '🔧 Reportar falla', callback_data: 'falla' }],
    [{ text: '✅ Validar comprobante', callback_data: 'comprobante' }],
    [{ text: '🧑‍💼 Hablar con asesor', callback_data: 'asesor' }],
    [{ text: '👥 Consultar para otra persona', callback_data: 'consulta_ajena' }],
  ],
};

// Menú de autoservicio para clientes recurrentes ya reconocidos (sin validar comprobante)
const AUTOSERVICIO_BASICO = {
  inline_keyboard: [
    [{ text: '💰 ¿Cuánto debo?', callback_data: 'deuda' }],
    [{ text: '📍 ¿Dónde pago?', callback_data: 'pago' }],
    [{ text: '🔧 Reportar falla', callback_data: 'falla' }],
    [{ text: '🧑‍💼 Hablar con asesor', callback_data: 'asesor' }],
    [{ text: '👥 Consultar para otra persona', callback_data: 'consulta_ajena' }],
  ],
};

// Pregunta al final de una consulta de autoservicio (cliente con un solo servicio)
const OTRA_CONSULTA = {
  inline_keyboard: [
    [
      { text: '✅ Sí', callback_data: 'si' },
      { text: '❌ No', callback_data: 'no' },
    ],
  ],
};

// Igual que OTRA_CONSULTA pero con opción de cambiar servicio (cliente multi-servicio)
const OTRA_CONSULTA_MULTI = {
  inline_keyboard: [
    [
      { text: '✅ Sí', callback_data: 'si' },
      { text: '❌ No', callback_data: 'no' },
    ],
    [{ text: '🔄 Consultar otro servicio', callback_data: 'cambiar_servicio' }],
  ],
};

// Confirmación de titularidad de cuenta tras identificación exitosa
const CONFIRMAR_CUENTA = {
  inline_keyboard: [
    [{ text: '✅ Sí, es mi cuenta',                  callback_data: 'si_mia'  }],
    [{ text: '👥 No, consulto por otra persona',      callback_data: 'no_mia' }],
  ],
};

// Selección del tipo de dato con el que el cliente quiere identificarse
const TIPO_IDENTIFICACION = {
  inline_keyboard: [
    [{ text: '🔢 ID de cliente',      callback_data: 'id_cliente' }],
    [{ text: '📱 Teléfono',           callback_data: 'tel'        }],
    [{ text: '🪪 ID de contrato',     callback_data: 'contrato'   }],
    [{ text: '📧 Correo electrónico', callback_data: 'email'      }],
    [{ text: '👤 Nombre de usuario',  callback_data: 'usuario'    }],
    [{ text: '📶 Nombre de red WiFi', callback_data: 'wifi'       }],
    [{ text: '🪪 Cédula',             callback_data: 'cedula'     }],
    [{ text: '🧑‍💼 Hablar con asesor', callback_data: 'asesor'     }],
  ],
};

/**
 * Genera un teclado dinámico con los servicios del cliente.
 * @param {Array<{etiqueta: string}>} servicios
 * @returns {object} Teclado inline de Telegram.
 */
function generarTecladoServicios(servicios) {
  return {
    inline_keyboard: [
      ...servicios.map((s, i) => [
        { text: `${i + 1}️⃣  ${s.etiqueta}`, callback_data: String(i + 1) },
      ]),
      [{ text: '👥 Consultar para otra persona', callback_data: 'consulta_ajena' }],
    ],
  };
}

/**
 * Devuelve el teclado de autoservicio correcto según el contexto del cliente.
 * Si tiene más de un servicio, agrega la opción "Cambiar servicio".
 * @param {object} meta - metadata de la conversación.
 * @returns {object} Teclado inline de Telegram.
 */
function getAutoservicioKeyboard(meta) {
  const base  = meta.identificado_via_wisp ? AUTOSERVICIO : AUTOSERVICIO_BASICO;
  const multi = (meta.cliente?.servicios?.length || 0) > 1;

  if (!multi) return base;

  return {
    inline_keyboard: [
      ...base.inline_keyboard,
      [{ text: '🔄 Cambiar servicio', callback_data: 'cambiar_servicio' }],
    ],
  };
}

/**
 * Devuelve el teclado de "¿Otra consulta?" con o sin opción de cambio de servicio.
 * @param {object} meta - metadata de la conversación.
 * @returns {object}
 */
function getOtraConsultaKeyboard(meta) {
  return (meta.cliente?.servicios?.length || 0) > 1 ? OTRA_CONSULTA_MULTI : OTRA_CONSULTA;
}

module.exports = {
  AREAS,
  EMPRESAS,
  ENCUESTA,
  CONFIRMAR_CUENTA,
  TIPO_CLIENTE,
  TIPO_IDENTIFICACION,
  AUTOSERVICIO,
  AUTOSERVICIO_BASICO,
  OTRA_CONSULTA,
  OTRA_CONSULTA_MULTI,
  generarTecladoServicios,
  getAutoservicioKeyboard,
  getOtraConsultaKeyboard,
};
