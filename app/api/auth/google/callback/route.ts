import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return new NextResponse(`Error: ${error}`);
  }

  if (!code) {
    return new NextResponse('No code provided', { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new NextResponse('Google OAuth credentials not configured', { status: 500 });
  }

  const origin = process.env.APP_URL || req.nextUrl.origin;
  const baseUrl = origin.endsWith('/') ? origin.slice(0, -1) : origin;
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange error:', tokenData);
      return new NextResponse(`Token exchange failed: ${tokenData.error_description || tokenData.error}`, { status: 500 });
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    // Fetch user info to get email
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text();
      console.error('Failed to fetch user info:', errorText);
      return new NextResponse(`Failed to fetch user info: ${errorText}`, { status: 500 });
    }

    const userInfo = await userInfoResponse.json();
    const userEmail = userInfo.email;

    // Check ALLOWED_EMAILS
    const allowedEmailsStr = process.env.ALLOWED_EMAILS;
    if (allowedEmailsStr && allowedEmailsStr.trim() !== '') {
      const allowedEmails = allowedEmailsStr.split(',').map(e => e.trim().toLowerCase());
      if (!allowedEmails.includes(userEmail.toLowerCase())) {
        const html = `
          <html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', provider: 'google', message: 'このアカウントは許可されていません。' }, '*');
                  window.close();
                } else {
                  window.location.href = '/?error=not_allowed';
                }
              </script>
              <p>Authentication failed: Email not allowed. This window should close automatically.</p>
            </body>
          </html>
        `;
        return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
      }
    }

    // Store tokens in cookies
    const cookieStore = await cookies();
    cookieStore.set('google_access_token', access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: expires_in || 3600,
      path: '/',
    });

    if (refresh_token) {
      cookieStore.set('google_refresh_token', refresh_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      });
    }

    cookieStore.set('user_email', userEmail, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    // Send success message to parent window and close popup
    const html = `
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider: 'google' }, '*');
              window.close();
            } else {
              window.location.href = '/recorder';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (err: any) {
    console.error('OAuth callback error:', err);
    return new NextResponse(`OAuth error: ${err.message}`, { status: 500 });
  }
}
