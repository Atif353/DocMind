const { createClient } = require('@supabase/supabase-js');

function createSupabaseClient(config) {
  if (!global.WebSocket) {
    global.WebSocket = require('ws');
  }

  return createClient(config.supabaseUrl, config.supabaseKey, {
    global: {
      fetch: (url, options = {}) => fetch(url, {
        ...options,
        signal: options.signal
          ? AbortSignal.any([options.signal, AbortSignal.timeout(10000)])
          : AbortSignal.timeout(10000)
      })
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    realtime: {
      params: { eventsPerSecond: 10 }
    }
  });
}

module.exports = { createSupabaseClient };
