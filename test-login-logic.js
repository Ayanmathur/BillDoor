require('dotenv').config({ path: 'client-portal/.env.local' });
const { loginAction } = require('./client-portal/.next/server/app/login/actions.js');
// We can't easily run next.js server actions outside, so I'll just write a mock of the DB check

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ulvmkmyjoetwmswgkwcb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsdm1rbXlqb2V0d21zd2drd2NiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDI4NTU5NSwiZXhwIjoyMDk5ODYxNTk1fQ.qFuMyrPc6qFVq7cVabGMlxSLDnHr9JRJa9fZmaoa6vg'
);

async function test() {
  const username = 'avm';
  const password = 'newpassword123';

  console.log('1. Fetching client...');
  const { data: client, error: lookupError } = await supabase
    .from('clients')
    .select('id, username, password_hash, status, deleted_at')
    .eq('username', username)
    .is('deleted_at', null)
    .single();

  if (lookupError || !client) {
    console.log('Lookup failed:', lookupError);
    return;
  }
  console.log('Client found:', client.username);

  console.log('2. Comparing password...');
  const passwordValid = await bcrypt.compare(password, client.password_hash);
  console.log('Password valid:', passwordValid);
}
test();
