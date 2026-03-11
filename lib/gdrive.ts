import { google } from 'googleapis';
import { Readable } from 'stream';

export async function saveToGoogleDrive(filename: string, audioBuffer: Buffer, mimeType: string, accessToken: string) {
  if (!accessToken) {
    throw new Error('Google Drive access token is missing');
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  const stream = new Readable();
  stream.push(audioBuffer);
  stream.push(null);

  try {
    const response = await drive.files.create({
      requestBody: {
        name: filename,
        mimeType: mimeType,
      },
      media: {
        mimeType: mimeType,
        body: stream,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Google Drive upload error:', error);
    throw error;
  }
}
