const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ulvmkmyjoetwmswgkwcb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsdm1rbXlqb2V0d21zd2drd2NiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDI4NTU5NSwiZXhwIjoyMDk5ODYxNTk1fQ.qFuMyrPc6qFVq7cVabGMlxSLDnHr9JRJa9fZmaoa6vg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listUsers() {
  const { data, error } = await supabase.from('clients').select('id, username, status, deleted_at, password_hash');
  console.log('Clients:', data, error);
}

listUsers();
