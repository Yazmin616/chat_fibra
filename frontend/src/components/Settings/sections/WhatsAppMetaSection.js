import React, { useState, useEffect } from 'react';
import { Smartphone, Info, CheckCircle, AlertCircle, ExternalLink, Users, Building2, MessageCircle } from 'lucide-react';
import { useSectionSave, SectionStatus } from '../settingsUtils';
import { apiService } from '../../../services/api';

/**
 * Vista de resumen para todas las empresas.
 */
const WhatsAppSummaryView = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiService.getResumenMeta()
      .then(res => setData(res || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ padding: '20px', color: '#667781' }}>Cargando resumen de empresas...</div>;
  }

  return (
    <div className="cfg-section-wrap">
      <div className="cfg-section-header">
        <h2>
          <span className="cfg-section-icon-h"><Smartphone size={20} /></span>
          Resumen WhatsApp / Meta (Multiempresa)
        </h2>
        <p>
          Vista general de los números conectados. Para configurar un número específico, selecciona una empresa en el filtro superior.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {data.length === 0 ? (
          <div className="wm-alert wm-alert--info">
            <div className="wm-alert-icon"><Info size={18} /></div>
            <div className="wm-alert-body">
              <p style={{ marginBottom: 0 }}>No hay configuraciones de WhatsApp guardadas en ninguna empresa.</p>
            </div>
          </div>
        ) : (
          data.map(emp => {
            const companyName = String(emp.empresa_id).toUpperCase();
            const phoneId = emp.env_whatsapp_phone_id;
            const isActive = !!phoneId;

            return (
              <div key={emp.empresa_id} className="wm-status-card" style={{ marginBottom: 0 }}>
                <div className="wm-status-left">
                  <div className="wm-phone-icon" style={{ width: 40, height: 40 }}>
                    <Smartphone size={22} />
                  </div>
                  <div className="wm-phone-info">
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#3b82f6', letterSpacing: '0.05em' }}>
                      {companyName}
                    </div>
                    {isActive ? (
                      <>
                        <div className="wm-phone-number" style={{ fontSize: '14px' }}>
                          Phone ID: {phoneId}
                        </div>
                        <div className="wm-phone-name" style={{ fontSize: '12px', color: '#16a34a' }}>
                          Conectado desde .env
                        </div>
                      </>
                    ) : (
                      <div className="wm-phone-name" style={{ fontSize: '13px' }}>
                        Sin configuración en .env
                      </div>
                    )}
                  </div>
                </div>
                <div className={`wm-status-badge ${isActive ? 'wm-status-badge--active' : 'wm-status-badge--inactive'}`}>
                  {isActive ? 'Activo' : 'Inactivo'}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};


/**
 * Sección: WhatsApp / Meta
 *
 * Muestra información del número de WhatsApp Business conectado,
 * explica cómo funcionan las conversaciones de Meta, y permite configurar
 * el margen de seguridad para el límite de mensajes.
 */
const WhatsAppMetaSection = ({ config, onSave, setDirty, empresaId }) => {
  const [margen, setMargen] = useState(String(config.wa_message_limit_margin ?? '10'));
  const { saveState, runSave } = useSectionSave(setDirty);

  const isDirty = margen !== String(config.wa_message_limit_margin ?? '10');

  const handleSave = () => runSave(onSave, [['wa_message_limit_margin', margen]]);

  const phoneId = config.env_whatsapp_phone_id;
  const isActive = !!phoneId;

  // Renderizar la vista de resumen si estamos en "Todas las empresas"
  if (empresaId === 'todas') {
    return <WhatsAppSummaryView />;
  }

  return (
    <div className="cfg-section-wrap">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="cfg-section-header">
        <h2>
          <span className="cfg-section-icon-h"><Smartphone size={20} /></span>
          WhatsApp / Meta
        </h2>
        <p>
          Estado del número de WhatsApp Business conectado y configuración de límites de la API de Meta.
        </p>
      </div>

      {/* ── Panel de estado del número (Solo lectura desde .env) ────────────── */}
      <div className="wm-status-card">
        <div className="wm-status-left">
          <div className="wm-phone-icon">
            <Smartphone size={28} />
          </div>
          <div className="wm-phone-info">
            {isActive ? (
              <>
                <div className="wm-phone-number">Phone ID: {phoneId}</div>
                <div className="wm-phone-name" style={{ color: '#16a34a', fontWeight: '500' }}>
                  Conectado de forma segura vía archivo .env
                </div>
              </>
            ) : (
              <>
                <div className="wm-phone-number" style={{ color: '#64748b' }}>No configurado</div>
                <div className="wm-phone-name">
                  Falta META_{empresaId.toUpperCase()}_WHATSAPP_PHONE_ID en .env
                </div>
              </>
            )}
          </div>
        </div>
        <div className={`wm-status-badge ${isActive ? 'wm-status-badge--active' : 'wm-status-badge--inactive'}`}>
          {isActive
            ? <><CheckCircle size={14} /> Activo</>
            : <><AlertCircle size={14} /> Inactivo</>
          }
        </div>
      </div>

      {/* ── Paso final si no está configurado ─────────────────────────────── */}
      {!isActive && (
        <div className="wm-alert wm-alert--info">
          <div className="wm-alert-icon"><Info size={18} /></div>
          <div className="wm-alert-body">
            <strong>¡Paso Final Importante!</strong>
            <p>
              Para completar la configuración de WhatsApp Business, necesitas agregar un método de pago
              en el Administrador de WhatsApp de Meta/Facebook.
            </p>
            <ol>
              <li>Ve al <strong>Administrador de WhatsApp</strong> haciendo clic en el enlace de abajo.</li>
              <li>Busca la sección <em>"Información general"</em>.</li>
              <li>Haz clic en el botón <em>"Agregar método de pago"</em>.</li>
              <li>Completa el proceso con tu tarjeta de crédito o débito.</li>
            </ol>
            <a
              href="https://business.facebook.com/wa/manage/home/"
              target="_blank"
              rel="noopener noreferrer"
              className="wm-btn-meta"
            >
              <ExternalLink size={15} />
              Ir al Administrador de WhatsApp
            </a>
          </div>
        </div>
      )}

      {/* ── Cómo funcionan las conversaciones ─────────────────────────────── */}
      <div className="wm-explainer-card">
        <div className="wm-explainer-header">
          <Info size={16} />
          <strong>¿Cómo funcionan las conversaciones de Meta?</strong>
        </div>
        <p className="wm-explainer-intro">
          Es importante entender cómo Meta/Facebook maneja el inicio de las conversaciones en WhatsApp Business.
        </p>
        <div className="wm-conv-grid">
          {/* Iniciadas por cliente */}
          <div className="wm-conv-col wm-conv-col--client">
            <div className="wm-conv-col-title">
              <MessageCircle size={14} />
              Conversaciones iniciadas por clientes
            </div>
            <ul>
              <li><span className="wm-tag wm-tag--free">GRATIS</span> Sin costo de mensaje</li>
              <li>Tú recibes el primer mensaje</li>
              <li>Tienes <strong>24 horas</strong> para responder gratis</li>
              <li>Puedes responder con <strong>cualquier tipo de mensaje</strong></li>
            </ul>
          </div>
          {/* Iniciadas por empresa */}
          <div className="wm-conv-col wm-conv-col--business">
            <div className="wm-conv-col-title">
              <Building2 size={14} />
              Conversaciones iniciadas por la empresa
            </div>
            <ul>
              <li><span className="wm-tag wm-tag--paid">COSTO</span> Se cobra por mensaje</li>
              <li>Tú envías el primer mensaje</li>
              <li>Solo puedes usar <strong>plantillas aprobadas</strong></li>
              <li>Requiere que tengas <strong>método de pago configurado</strong></li>
            </ul>
          </div>
        </div>
        <div className="wm-recomendacion">
          <strong>💡 Recomendación:</strong> Para iniciar conversaciones gratis, motiva a tus clientes
          a que te escriban primero. Puedes hacerlo mediante códigos QR, links directos, o campañas
          que los inviten a contactarte.
        </div>
        <div className="wm-explainer-note">
          <Info size={12} />
          Ventana de 24 horas: Una vez que el cliente escribe, tienes 24 horas para responder.
          Si el tiempo expira, solo podrás reabrir la conversación con una plantilla aprobada.
        </div>
      </div>

      {/* ── Margen de seguridad de mensajes ───────────────────────────────── */}
      <div className="wm-margin-section">
        <div className="setting-item sc-row">
          <div className="setting-info">
            <label htmlFor="wa-msg-margin">
              Margen de seguridad para límite de mensajes *
            </label>
            <span>
              Número de mensajes de reserva antes de alcanzar el límite diario de Meta.
              Si tu límite es 1,000 mensajes/día y el margen es 10, el sistema alertará al llegar a 990.
            </span>
          </div>
          <div className="wm-margin-input-wrap">
            <input
              id="wa-msg-margin"
              type="number"
              min="1"
              max="1000"
              value={margen}
              onChange={e => { setMargen(e.target.value); setDirty(true); }}
              className="wm-margin-input"
            />
          </div>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="sc-footer">
        {isDirty && (
          <span style={{ color: '#d97706', fontSize: '13px', fontWeight: '500', marginRight: 'auto' }}>
            ⚠️ Tienes cambios sin guardar.
          </span>
        )}
        <SectionStatus state={saveState} />
        <button
          className="btn-save"
          disabled={saveState === 'saving' || !isDirty || parseInt(margen) < 1}
          onClick={handleSave}
        >
          {saveState === 'saving' ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
};

export default WhatsAppMetaSection;
