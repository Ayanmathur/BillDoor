const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ulvmkmyjoetwmswgkwcb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsdm1rbXlqb2V0d21zd2drd2NiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODU1OTUsImV4cCI6MjA5OTg2MTU5NX0.XO4Sa3Y3eL0eo6abhPDMvraSlq27EPdy5-NJbShCXzo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'Amathur@billdoor.local',
    password: 'password123' // Fake password to see error
  });
  console.log('Login Result:', data, error?.message);
}

testLogin();
