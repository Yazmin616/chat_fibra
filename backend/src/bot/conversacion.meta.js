/**
 * @file conversacion.meta.js
 * @description Wrapper tipado para el campo JSONB `metadata` de una conversación.
 *
 * Centraliza los defaults y los getters derivados para que los states
 * no accedan directamente al JSONB libre ni repitan `|| {}` / `?? 0`.
 *
 * Uso en un state:
 *   const meta = new ConversacionMeta(conversacion.metadata);
 *   meta.cliente        // objeto cliente WISP o null
 *   meta.servicio       // servicio seleccionado (respeta servicio_idx)
 *   meta.esMultiServicio
 */

class ConversacionMeta {
  /**
   * @param {object} [raw={}] - Valor crudo de conversacion.metadata (puede ser null).
   */
  constructor(raw = {}) {
    const src = raw || {};

    /** @type {object|null} Datos del cliente WISP (nombre, servicios[]). */
    this.cliente = src.cliente || null;

    /** @type {number} Índice del servicio seleccionado en cliente.servicios. */
    this.servicio_idx = src.servicio_idx ?? 0;

    /** @type {string|null} Tipo de identificación elegido en Fase 1. */
    this.tipo_identificacion = src.tipo_identificacion || null;

    /** @type {number} Número de intentos de identificación fallidos. */
    this.intentos_identificacion = src.intentos_identificacion || 0;

    /** @type {number} Mensajes consecutivos no reconocidos por el bot (para auto-escalada). */
    this.intentos_fallidos = src.intentos_fallidos || 0;

    /** @type {boolean} El cliente consulta por otra persona (temporal). */
    this.consulta_ajena = src.consulta_ajena || false;

    /** @type {boolean} El cliente fue identificado vía WISP en esta o sesiones anteriores. */
    this.identificado_via_wisp = src.identificado_via_wisp || false;

    /**
     * Intención detectada por NLU pendiente de confirmación del cliente.
     * @type {{intencion: string, depto: string|null}|null}
     */
    this.intencion_pendiente = src.intencion_pendiente || null;
  }

  /** Servicio actualmente seleccionado según servicio_idx. */
  get servicio() {
    if (!this.cliente?.servicios?.length) return null;
    return this.cliente.servicios[this.servicio_idx] ?? this.cliente.servicios[0];
  }

  /** true si el cliente tiene más de un servicio registrado. */
  get esMultiServicio() {
    return (this.cliente?.servicios?.length || 0) > 1;
  }

  /** Serializa a objeto plano para `conversacionRepo.updateMetadata()`. */
  toJSON() {
    return {
      cliente:                 this.cliente,
      servicio_idx:            this.servicio_idx,
      tipo_identificacion:     this.tipo_identificacion,
      intentos_identificacion: this.intentos_identificacion,
      intentos_fallidos:       this.intentos_fallidos,
      consulta_ajena:          this.consulta_ajena,
      identificado_via_wisp:   this.identificado_via_wisp,
      intencion_pendiente:     this.intencion_pendiente,
    };
  }
}

/**
 * Crea un ConversacionMeta a partir de un objeto conversación.
 * @param {object} conversacion
 * @returns {ConversacionMeta}
 */
function fromConversacion(conversacion) {
  return new ConversacionMeta(conversacion.metadata);
}

module.exports = { ConversacionMeta, fromConversacion };
