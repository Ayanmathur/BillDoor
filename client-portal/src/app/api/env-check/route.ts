import { NextResponse } from 'next/server';

export async function GET() {
  const envStatus = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL_VALUE_STARTS_WITH_HTTPS: process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('https://'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'missing',
  };

  return NextResponse.json({
    message: "If SUPABASE_SERVICE_ROLE_KEY is false, that is the exact reason your login and license keys are failing. Please add it in Vercel.",
    status: envStatus
  });
}
