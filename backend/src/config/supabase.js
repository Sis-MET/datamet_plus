const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

let adminClient;

const getSupabaseAdminClient = () => {
  if (!env.ivmet.enabled) {
    const error = new Error('El modulo Gestion IvMET no esta habilitado');
    error.statusCode = 503;
    throw error;
  }

  if (!adminClient) {
    adminClient = createClient(
      env.ivmet.supabaseUrl,
      env.ivmet.supabaseSecretKey,
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false
        },
        global: {
          headers: { 'X-Client-Info': 'rimmet-ivmet-admin/1.0' }
        }
      }
    );
  }

  return adminClient;
};

module.exports = { getSupabaseAdminClient };
