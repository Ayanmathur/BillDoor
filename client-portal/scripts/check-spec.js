const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkSpec() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_SERVICE_ROLE_KEY}`);
  const json = await res.json();
  const paths = Object.keys(json.paths);
  console.log("Tables exposed:", paths.filter(p => !p.startsWith('/rpc/')));
}

checkSpec();
