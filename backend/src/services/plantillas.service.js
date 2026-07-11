const repo = require('../repositories/plantillas.repository');

const DEFAULT_TEMPLATES = {
  saludo_inicial: '👋 ¡Hola, {{nombre}}! Bienvenido/a a {{empresa}}.\n\n¿Cómo puedo ayudarte? Toca una opción o escribe tu consulta.\n\n_Para hablar directamente con un asesor, escribe "asesor"._',
  saludo_recurrente_multiservicio: '👋 ¡Hola de nuevo, {{nombre}}! Bienvenido/a a {{empresa}}.\n\nTienes varios servicios registrados. ¿Cuál deseas consultar?\n\n{{lista_servicios}}',
  saludo_recurrente_autoservicio: '👋 ¡Hola de nuevo, {{nombre}}! Bienvenido/a a {{empresa}}.\n\n¿En qué puedo ayudarte hoy?',
  saludo_recurrente_identificacion: '👋 ¡Hola de nuevo, {{nombre}}! Bienvenido/a a {{empresa}}.\n\nPara consultar tu servicio, necesito verificar tus datos. ¿Con qué te identificas?',
  seleccion_empresa: '👋 ¡Hola, {{nombre}}! Bienvenido/a.\n\n¿A cuál de nuestras empresas deseas comunicarte?',
  opcion_no_reconocida: 'Opción no reconocida. Por favor elige una de las siguientes opciones:',
  
  identificacion_tipo: 'Por favor selecciona una opción para identificarte:',
  identificacion_pedir_dato: 'Por favor escribe tu *{{tipo_dato}}*:',
  identificacion_no_encontrado: 'No pudimos identificarte con los datos proporcionados.\n\nIntenta con otro tipo de identificación _({{intentos}} intentos restantes)_:',
  identificacion_fallida_final: '⚠️ No pudimos identificarte con los datos proporcionados.\n\nTe conectamos con un asesor para que pueda ayudarte directamente. 🙏',
  
  cuenta_encontrada_mia: '✅ Encontramos la cuenta de *{{nombre}}*.\n\n¿Es tu cuenta?',
  cuenta_encontrada_ajena: '✅ Cuenta de *{{nombre}}* encontrada.\n\n¿En qué puedo ayudarte?',
  cuenta_encontrada_ajena_multi: '✅ Cuenta de *{{nombre}}* encontrada.\n\n¿Cuál servicio deseas consultar?\n\n{{lista_servicios}}',
  cuenta_multi_servicio: 'Tienes varios servicios. ¿Cuál deseas consultar?',
  
  menu_autoservicio: '¿En qué puedo ayudarte?',
  menu_otra_consulta: '¿Deseas realizar otra consulta?',
  
  estado_cuenta_con_deuda: '📋 *Estado de cuenta*\n\n📍 {{etiqueta}}\n💰 Saldo pendiente: *${{deuda}} MXN*\n📅 Fecha límite: {{fecha_vencimiento}}\n{{estado_icon}}',
  estado_cuenta_sin_deuda: '📋 *Estado de cuenta*\n\n📍 {{etiqueta}}\n\n¡Estás al corriente! No tienes saldo pendiente. 🥳',
  info_pago: '💳 *¿Dónde pagar?*\n\nPara tu servicio *{{etiqueta}}* puedes pagar en:\n\n🌐 Portal en línea:\n{{portal_pago}}\n\n🏦 También puedes pagar en cualquiera de nuestras sucursales o corresponsales autorizados.',
  
  escalar_soporte: '🛠️ Te conectamos con *{{departamento}}*.\n\nDescribe tu problema y un asesor te atenderá pronto. 👨‍💻',
  escalar_ventas: '🤝 Entendí que quieres información sobre planes o contratos.\n\nTe conectamos con *{{departamento}}*. ¡Pronto un asesor te contactará! 👨‍💻',
  escalar_cobranza: '💰 Entendí que tu consulta es sobre pagos o saldos.\n\nTe conectamos con *{{departamento}}*. Un asesor te atenderá en breve. 👨‍💻',
  
  agradecimiento_despedida: '¡Gracias a ti! 😊 Si necesitas algo más en el futuro, no dudes en escribirme. ¡Hasta luego! 👋',
  
  error_general: 'Ocurrió un error inesperado. Por favor intenta de nuevo.'
};

const TEMPLATE_DESCRIPTIONS = {
  saludo_inicial: 'Mensaje inicial de bienvenida al cliente.',
  saludo_recurrente_multiservicio: 'Saludo a cliente reconocido con varios servicios. Vars: {{nombre}}, {{empresa}}, {{lista_servicios}}',
  saludo_recurrente_autoservicio: 'Saludo a cliente reconocido listo para autoservicio. Vars: {{nombre}}, {{empresa}}',
  saludo_recurrente_identificacion: 'Saludo a cliente recurrente pidiendo identificarse. Vars: {{nombre}}, {{empresa}}',
  seleccion_empresa: 'Mensaje genérico cuando el bot atiende varias empresas. Vars: {{nombre}}',
  opcion_no_reconocida: 'Cuando el bot no entiende la opción seleccionada.',
  identificacion_tipo: 'Pregunta al cliente cómo desea identificarse.',
  identificacion_pedir_dato: 'Pide el dato específico de identificación. Variable: {{tipo_dato}}',
  identificacion_no_encontrado: 'Cuando no se encuentra la cuenta. Variable: {{intentos}}',
  identificacion_fallida_final: 'Cuando el cliente agota los intentos de identificación.',
  cuenta_encontrada_mia: 'Confirmación de cuenta encontrada. Variable: {{nombre}}',
  cuenta_encontrada_ajena: 'Confirmación al buscar cuenta de un tercero (1 servicio). Variable: {{nombre}}',
  cuenta_encontrada_ajena_multi: 'Confirmación al buscar cuenta de tercero (multi-servicio). Vars: {{nombre}}, {{lista_servicios}}',
  cuenta_multi_servicio: 'Cuando una cuenta tiene varios servicios asociados.',
  menu_autoservicio: 'Pregunta general del menú principal.',
  menu_otra_consulta: 'Pregunta para volver al menú de autoservicio.',
  estado_cuenta_con_deuda: 'Muestra saldo pendiente. Vars: {{etiqueta}}, {{deuda}}, {{fecha_vencimiento}}, {{estado_icon}}',
  estado_cuenta_sin_deuda: 'Muestra cuando no hay saldo pendiente. Vars: {{etiqueta}}',
  info_pago: 'Información de dónde realizar pagos. Vars: {{etiqueta}}, {{portal_pago}}',
  escalar_soporte: 'Mensaje al transferir a Soporte. Variable: {{departamento}}',
  escalar_ventas: 'Mensaje al transferir a Ventas. Variable: {{departamento}}',
  escalar_cobranza: 'Mensaje al transferir a Cobranza. Variable: {{departamento}}',
  agradecimiento_despedida: 'Respuesta automática a agradecimientos.',
  error_general: 'Mensaje de error inesperado.'
};

// Simple in-memory cache to avoid DB hits on every single message
// cache[empresa_id][clave] = texto
let _cache = {};
let _cacheTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute

async function _refreshCache(empresa_id) {
  if (!_cache[empresa_id]) _cache[empresa_id] = {};
  
  try {
    const { rows } = await repo.findAll(empresa_id);
    _cache[empresa_id] = {}; // clear for this empresa
    for (const row of rows) {
      _cache[empresa_id][row.clave] = row.texto;
    }
  } catch (err) {
    console.error(`[Plantillas] Error refrescando cache para ${empresa_id}:`, err.message);
  }
}

/**
 * Obtiene el texto de una plantilla renderizando las variables
 */
async function getTexto(clave, empresa_id, variables = {}) {
  const now = Date.now();
  if (now - _cacheTime > CACHE_TTL_MS || !_cache[empresa_id]) {
    await _refreshCache(empresa_id);
    _cacheTime = now;
  }

  let texto = (_cache[empresa_id] && _cache[empresa_id][clave]) 
    ? _cache[empresa_id][clave] 
    : (DEFAULT_TEMPLATES[clave] || `[Plantilla ${clave} no configurada]`);

  for (const [key, val] of Object.entries(variables)) {
    texto = texto.replace(new RegExp(`{{${key}}}`, 'g'), val);
  }

  return texto;
}

/**
 * Para uso en el controlador de la API
 */
async function getAllTemplates(empresa_id) {
  const { rows } = await repo.findAll(empresa_id);
  
  const result = [];
  // Merge default templates with DB templates
  for (const [clave, defaultText] of Object.entries(DEFAULT_TEMPLATES)) {
    const dbEntry = rows.find(r => r.clave === clave);
    result.push({
      clave,
      texto: dbEntry ? dbEntry.texto : defaultText,
      descripcion: TEMPLATE_DESCRIPTIONS[clave] || '',
      es_personalizado: !!dbEntry
    });
  }
  return result;
}

/**
 * Guarda o actualiza una plantilla
 */
async function saveTemplate(empresa_id, clave, texto) {
  if (!DEFAULT_TEMPLATES[clave]) {
    throw new Error(`La clave '${clave}' no es una plantilla válida.`);
  }
  
  // Si el texto es igual al default (o vacío), la borramos de la BD para usar el predeterminado
  if (!texto || texto.trim() === '' || texto.trim() === DEFAULT_TEMPLATES[clave]) {
    await repo.deleteByClave(empresa_id, clave);
  } else {
    await repo.upsert(empresa_id, clave, texto.trim(), TEMPLATE_DESCRIPTIONS[clave]);
  }
  
  // Force cache refresh
  await _refreshCache(empresa_id);
}

module.exports = {
  getTexto,
  getAllTemplates,
  saveTemplate,
  DEFAULT_TEMPLATES,
  TEMPLATE_DESCRIPTIONS
};
