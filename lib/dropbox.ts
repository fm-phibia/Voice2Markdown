import { Dropbox } from 'dropbox';

export async function getValidDropboxToken(accessToken?: string, refreshToken?: string): Promise<string | undefined> {
  if (accessToken) return accessToken;
  if (!refreshToken) return process.env.DROPBOX_ACCESS_TOKEN;

  const clientId = process.env.DROPBOX_CLIENT_ID;
  const clientSecret = process.env.DROPBOX_CLIENT_SECRET;

  if (!clientId || !clientSecret) return process.env.DROPBOX_ACCESS_TOKEN;

  try {
    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.access_token;
    }
  } catch (error) {
    console.error('Failed to refresh Dropbox token:', error);
  }

  return process.env.DROPBOX_ACCESS_TOKEN;
}

export async function saveToDropbox(filename: string, content: string, accessToken?: string) {
  const token = accessToken || process.env.DROPBOX_ACCESS_TOKEN;
  if (!token) {
    throw new Error('Dropbox access token is missing');
  }

  const dbx = new Dropbox({ accessToken: token, fetch: fetch });
  
  const savePath = process.env.DROPBOX_SAVE_PATH || '/Obsidian/Journals/';
  const normalizedPath = savePath.startsWith('/') ? savePath : `/${savePath}`;
  const finalPath = normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`;
  
  try {
    const response = await dbx.filesUpload({
      path: `${finalPath}${filename}.md`,
      contents: content,
      mode: { '.tag': 'overwrite' }
    });
    return response;
  } catch (error) {
    console.error('Dropbox upload error:', error);
    throw error;
  }
}
