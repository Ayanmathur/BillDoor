import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  let geminiApiTest = 'not_tested';

  if (apiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Ping' }] }] }),
        }
      );
      geminiApiTest = res.ok ? 'working' : `error_${res.status}`;
    } catch (e: any) {
      geminiApiTest = `exception_${e.message}`;
    }
  } else {
    geminiApiTest = 'missing_key';
  }

  const envStatus = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    GEMINI_API_KEY_PRESENT: !!apiKey,
    GEMINI_API_LIVE_STATUS: geminiApiTest,
  };

  return NextResponse.json({ status: envStatus });
}
