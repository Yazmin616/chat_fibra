const axios = require('axios');

// Estado interno del polling (aislado del resto de la lógica)
const state = {
  meta: {
    enabled: false,
    isPolling: false,
    lastTimestamp: Math.floor(Date.now() / 1000),
    errorCount: 0,
    updates: []
  },
  telegram: {
    enabled: false,
    isPolling: false,
    lastOffset: 0,
    errorCount: 0,
    updates: []
  },
  activeAgents: new Set()
};

const CONFIG = {
  INTERVAL_MS: 5000,
  MAX_RETRIES: 3,
  BASE_BACKOFF_MS: 1000
};

// ---------------------------------------------------------
// Control en caliente (Habilitar/Deshabilitar)
// ---------------------------------------------------------
const setAgentOnline = (id) => state.activeAgents.add(Number(id));
const setAgentOffline = (id) => state.activeAgents.delete(Number(id));

const enableMetaPolling = () => {
  if (state.meta.enabled) return;
  state.meta.enabled = true;
  console.log('[Polling Service] Meta activado');
  pollMeta();
};

const disableMetaPolling = () => {
  state.meta.enabled = false;
  console.log('[Polling Service] Meta desactivado');
};

const enableTelegramPolling = () => {
  if (state.telegram.enabled) return;
  state.telegram.enabled = true;
  console.log('[Polling Service] Telegram activado');
  pollTelegram();
};

const disableTelegramPolling = () => {
  state.telegram.enabled = false;
  console.log('[Polling Service] Telegram desactivado');
};

// ---------------------------------------------------------
// Polling a Meta API
// ---------------------------------------------------------
const pollMeta = async () => {
  if (!state.meta.enabled || state.meta.isPolling) return;
  
  state.meta.isPolling = true;
  try {
    const token = process.env.META_API_TOKEN;
    const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
    
    if (token && phoneNumberId) {
      // 1 llamada por segundo máximo garantizada por el intervalo
      const response = await axios.get(`https://graph.facebook.com/v17.0/${phoneNumberId}/messages`, {
        params: {
          access_token: token,
          since: state.meta.lastTimestamp
        }
      });

      const data = response.data;
      if (data && data.data && data.data.length > 0) {
        const newUpdates = data.data.map(msg => ({
          source: 'meta',
          timestamp: new Date().toISOString(),
          data: msg
        }));
        state.meta.updates.push(...newUpdates);
        state.meta.lastTimestamp = Math.floor(Date.now() / 1000);
      }
      state.meta.errorCount = 0;
    }
  } catch (error) {
    state.meta.errorCount++;
    if (error.response && [401, 403].includes(error.response.status)) {
      console.error('[Polling Service] Token Meta expirado. Deteniendo ciclo.');
      disableMetaPolling();
    }
  } finally {
    state.meta.isPolling = false;
    if (state.meta.enabled) {
      const waitTime = state.meta.errorCount > 0 
        ? Math.min(CONFIG.BASE_BACKOFF_MS * Math.pow(2, state.meta.errorCount), 30000)
        : CONFIG.INTERVAL_MS;
      setTimeout(pollMeta, waitTime);
    }
  }
};

// ---------------------------------------------------------
// Polling a Telegram Bot API
// ---------------------------------------------------------
const pollTelegram = async () => {
  if (!state.telegram.enabled || state.telegram.isPolling) return;
  
  state.telegram.isPolling = true;
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      const response = await axios.get(`https://api.telegram.org/bot${token}/getUpdates`, {
        params: {
          offset: state.telegram.lastOffset,
          timeout: 0 // Timeout 0 para no bloquear a la app Node
        }
      });

      const data = response.data;
      if (data.ok && data.result.length > 0) {
        const newUpdates = data.result.map(update => ({
          source: 'telegram',
          timestamp: new Date().toISOString(),
          data: update
        }));
        state.telegram.updates.push(...newUpdates);
        
        const maxUpdateId = Math.max(...data.result.map(u => u.update_id));
        state.telegram.lastOffset = maxUpdateId + 1;
      }
      state.telegram.errorCount = 0;
    }
  } catch (error) {
    state.telegram.errorCount++;
    if (error.response && error.response.status === 401) {
      console.error('[Polling Service] Token Telegram expirado. Deteniendo ciclo.');
      disableTelegramPolling();
    }
  } finally {
    state.telegram.isPolling = false;
    if (state.telegram.enabled) {
      const waitTime = state.telegram.errorCount > 0 
        ? Math.min(CONFIG.BASE_BACKOFF_MS * Math.pow(2, state.telegram.errorCount), 30000)
        : CONFIG.INTERVAL_MS;
      setTimeout(pollTelegram, waitTime);
    }
  }
};

// ---------------------------------------------------------
// Endpoint interno para aislar la lógica del front
// ---------------------------------------------------------
const setupPollingEndpoint = (app) => {
  // Inyectamos exactamente 1 ruta que no interfiere con las existentes
  app.get('/api/polling/updates', (req, res) => {
    const since = req.query.since;
    
    let allUpdates = [...state.meta.updates, ...state.telegram.updates];
    allUpdates.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    if (since) {
      const sinceDate = new Date(since);
      allUpdates = allUpdates.filter(u => new Date(u.timestamp) > sinceDate);
    }

    // Limpieza ligera para no llenar RAM
    if (state.meta.updates.length > 1000) state.meta.updates = state.meta.updates.slice(-500);
    if (state.telegram.updates.length > 1000) state.telegram.updates = state.telegram.updates.slice(-500);

    res.json({
      success: true,
      updates: allUpdates,
      activeAgents: Array.from(state.activeAgents),
      serverTimestamp: new Date().toISOString()
    });
  });
};

module.exports = {
  enableMetaPolling,
  disableMetaPolling,
  enableTelegramPolling,
  disableTelegramPolling,
  setupPollingEndpoint,
  setAgentOnline,
  setAgentOffline,
  getActiveAgents: () => Array.from(state.activeAgents)
};
