import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('dropbox_access_token')?.value;
  const refreshToken = cookieStore.get('dropbox_refresh_token')?.value;
  const envToken = process.env.DROPBOX_ACCESS_TOKEN;

  // We consider it connected if we have a valid token in cookies, or a refresh token, or an env token
  const isConnected = !!(accessToken || refreshToken || envToken);

  return NextResponse.json({ connected: isConnected });
}
