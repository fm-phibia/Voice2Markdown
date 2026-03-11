import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const clientId = process.env.DROPBOX_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'DROPBOX_CLIENT_ID is not configured' }, { status: 500 });
  }

  const origin = process.env.APP_URL || new URL(request.url).origin;
  // Handle potential trailing slash in APP_URL
  const baseUrl = origin.endsWith('/') ? origin.slice(0, -1) : origin;
  const redirectUri = `${baseUrl}/api/auth/dropbox/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    token_access_type: 'offline',
  });

  const authUrl = `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;

  return NextResponse.json({ url: authUrl });
}
