/**
 * @file utils/vars.js
 * @description Sustitución centralizada de variables de plantilla en mensajes salientes.
 *
 * REGLA: cualquier mensaje con variables {clave} DEBE pasar por interpolarVars()
 * antes de enviarse al cliente. La vista previa del frontend usa su propia lógica
 * con datos de ejemplo; el backend usa esta función con datos reales.
 *
 * Fallbacks: si una variable no tiene valor, se usa el fallback definido en FALLBACKS.
 * Variables desconocidas que queden sin sustituir se eliminan ({foo} → '').
 * Nunca debe llegar un placeholder crudo al cliente.
 */

/** Fallback por variable cuando no hay valor disponible. */
const FALLBACKS = {
  nombre_cliente:    '',              // vacío → la plantilla debe redactarse sin depender de él
  empresa:           '',
  area:              '',
  nombre_agente:     'nuestro asesor',
  horarios_atencion: '',
  proximo_dia_habil: '',
  telefonos_areas:   '',
};

/**
 * Sustituye todas las variables {clave} en `template` por sus valores reales.
 *
 * @param {string} template - Plantilla con variables {clave}.
 * @param {Record<string, string|null|undefined>} vars - Valores reales a sustituir.
 * @returns {string} Texto con todas las variables reemplazadas, sin placeholders residuales.
 */
function interpolarVars(template, vars = {}) {
  if (!template) return '';

  let result = template;

  // Sustituir variables conocidas (con fallback si el valor está vacío/nulo)
  const todas = { ...FALLBACKS, ...vars };
  for (const [key, val] of Object.entries(todas)) {
    const valor = (val != null && String(val).trim() !== '')
      ? String(val)
      : (FALLBACKS[key] ?? '');
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), valor);
  }

  // Eliminar cualquier {variable} desconocida restante — nunca debe llegar al cliente
  result = result.replace(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g, '');

  return result;
}

/**
 * Extrae el nombre legible de un usuario evitando IDs técnicos crudos.
 * PSIDs de Meta y similares (≥10 dígitos) no son nombres reales.
 *
 * @param {string|null} nombre
 * @returns {string} Nombre limpio, o '' si es un ID crudo.
 */
function nombreLimpio(nombre) {
  if (!nombre) return '';
  if (/^\d{10,}$/.test(String(nombre))) return ''; // PSID / IGSID
  return String(nombre).trim();
}

const MSG_DEFAULT_MANTENIMIENTO =
  '⚙️ *{empresa}* se encuentra temporalmente en mantenimiento.\n\n' +
  'Mientras tanto, puedes comunicarte directamente con nosotros:\n\n' +
  '{telefonos_areas}\n\n' +
  'En breve restableceremos el servicio. ¡Gracias por tu paciencia! 🙏';

/**
 * Construye el texto del mensaje de mantenimiento a partir del configMap ya cargado.
 * No hace consultas a la DB — usa el configMap que el caller ya tiene.
 *
 * @param {Record<string,string>} cfg     - configMap de la empresa (clave→valor).
 * @param {Record<string,string>} vars    - Variables adicionales: empresa, area, nombre_cliente…
 * @returns {string}
 */
function buildMsgMantenimiento(cfg, vars = {}) {
  const telEmpresa = cfg.tel_empresa || '';
  
  let lineas = [];
  if (cfg.extensiones_areas) {
    try {
      const extMap = JSON.parse(cfg.extensiones_areas);
      for (const [areaName, ext] of Object.entries(extMap)) {
        if (ext && ext.trim()) {
          lineas.push(`🔹 ${areaName}: Ext. ${ext}`);
        }
      }
    } catch(e) {}
  }
  
  // Fallback for old configs that haven't been saved with the new UI yet
  if (lineas.length === 0) {
    const viejas = [
      cfg.ext_soporte  ? `🔧 Soporte Técnico: Ext. ${cfg.ext_soporte}`  : '',
      cfg.ext_ventas   ? `💼 Ventas: Ext. ${cfg.ext_ventas}`            : '',
      cfg.ext_cobranza ? `💰 Cobranza: Ext. ${cfg.ext_cobranza}`        : '',
    ].filter(Boolean);
    lineas = viejas;
  }

  let telefonos = '';
  if (telEmpresa) {
    telefonos += `📞 Teléfono Principal: ${telEmpresa}\n`;
  }
  
  if (lineas.length) {
    if (telEmpresa) telefonos += `\n`;
    telefonos += `Extensiones:\n` + lineas.join('\n');
  } else if (!telEmpresa) {
    telefonos = 'Consulta nuestros canales de contacto.';
  }

  const template  = (cfg.msg_mantenimiento && cfg.msg_mantenimiento.trim()) || MSG_DEFAULT_MANTENIMIENTO;
  return interpolarVars(template, { ...vars, telefonos_areas: telefonos });
}

module.exports = { interpolarVars, nombreLimpio, buildMsgMantenimiento };
