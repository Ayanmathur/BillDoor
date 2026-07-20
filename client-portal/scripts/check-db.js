const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkDb() {
  const { data, error } = await adminClient.from('license_keys').select('id').limit(1);
  console.log("license_keys:", data, error);
  
  const { data: clients, error: clientsError } = await adminClient.from('clients').select('id').limit(1);
  console.log("clients:", clients, clientsError);
}

checkDb();
