import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return new NextResponse(`<html><body><p>Error: ${error}</p></body></html>`, {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (!code) {
    return new NextResponse('<html><body><p>No code provided</p></body></html>', {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const clientId = process.env.DROPBOX_CLIENT_ID;
  const clientSecret = process.env.DROPBOX_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new NextResponse('<html><body><p>Dropbox credentials not configured</p></body></html>', {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const origin = process.env.APP_URL || req.nextUrl.origin;
  const baseUrl = origin.endsWith('/') ? origin.slice(0, -1) : origin;
  const redirectUri = `${baseUrl}/api/auth/dropbox/callback`;

  try {
    const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      throw new Error(`Failed to exchange code: ${errorData}`);
    }

    const data = await tokenResponse.json();
    
    const cookieStore = await cookies();
    cookieStore.set('dropbox_access_token', data.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: data.expires_in || 14400, // Default 4 hours
    });

    if (data.refresh_token) {
      cookieStore.set('dropbox_refresh_token', data.refresh_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
    }

    return new NextResponse(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider: 'dropbox' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error: any) {
    console.error('Dropbox OAuth error:', error);
    return new NextResponse(`<html><body><p>Authentication failed: ${error.message}</p></body></html>`, {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
