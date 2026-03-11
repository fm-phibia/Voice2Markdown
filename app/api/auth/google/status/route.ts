import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('google_access_token')?.value;
  
  return NextResponse.json({ 
    connected: !!token 
  });
}
