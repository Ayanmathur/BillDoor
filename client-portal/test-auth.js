const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ulvmkmyjoetwmswgkwcb.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsdm1rbXlqb2V0d21zd2drd2NiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODU1OTUsImV4cCI6MjA5OTg2MTU5NX0.XO4Sa3Y3eL0eo6abhPDMvraSlq27EPdy5-NJbShCXzo');

async function testAuth() {
  // Try logging in with some passwords to see which one works
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'bangre@billdoor.local',
    password: 'password123'
  });
  console.log('Test password123:', data.user?.email, error?.message);
}
testAuth();
