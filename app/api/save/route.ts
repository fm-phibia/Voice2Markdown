import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { saveToDropbox, getValidDropboxToken } from '@/lib/dropbox';
import { saveToGoogleDrive } from '@/lib/gdrive';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const googleAccessToken = cookieStore.get('google_access_token')?.value;
    const dropboxAccessToken = cookieStore.get('dropbox_access_token')?.value;
    const dropboxRefreshToken = cookieStore.get('dropbox_refresh_token')?.value;

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const transcription = formData.get('transcription') as string;
    const skipGoogleDrive = formData.get('skipGoogleDrive') === 'true';
    
    if (!audioFile || !transcription) {
      return NextResponse.json({ error: 'Missing audio or transcription' }, { status: 400 });
    }

    const date = new Date();
    // JSTに変換 (UTC+9)
    const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const yyyy = jstDate.getUTCFullYear();
    const mm = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(jstDate.getUTCDate()).padStart(2, '0');
    const hh = String(jstDate.getUTCHours()).padStart(2, '0');
    const min = String(jstDate.getUTCMinutes()).padStart(2, '0');
    const ss = String(jstDate.getUTCSeconds()).padStart(2, '0');

    const filenameBase = `vj-${yyyy}${mm}${dd}${hh}${min}${ss}`;
    
    const audioFilename = `${filenameBase}.webm`;
    const mdFilename = filenameBase;

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Google Drive
    let driveResult = null;
    if (googleAccessToken && !skipGoogleDrive) {
      try {
        driveResult = await saveToGoogleDrive(audioFilename, buffer, audioFile.type || 'audio/webm', googleAccessToken);
      } catch (e: any) {
        console.warn('Failed to save to Google Drive:', e.message);
        throw new Error(`Google Drive Error: ${e.message}`);
      }
    } else if (skipGoogleDrive) {
      console.log('Skipping Google Drive upload as requested.');
    } else {
      console.warn('Google Drive access token not found. Skipping Google Drive upload.');
    }

    // Format Markdown
    const markdownContent = `## ${yyyy}年${mm}月${dd}日${hh}:${min}頃のボイスジャーナル\n${transcription}\n[[${yyyy}-${mm}-${dd}]]`;

    // Upload to Dropbox with retry logic
    let dropboxResult = null;
    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Try to get a fresh token on each attempt
        const freshToken = await getValidDropboxToken(dropboxAccessToken, dropboxRefreshToken);
        dropboxResult = await saveToDropbox(mdFilename, markdownContent, freshToken);
        lastError = null;
        break; // Success, exit retry loop
      } catch (e: any) {
        lastError = e;
        console.warn(`Dropbox save attempt ${attempt}/${maxRetries} failed:`, e.message || e);

        const errorMessage = e?.error?.error_summary || e.message || String(e);
        const isAuthError = errorMessage.includes('401') ||
                          errorMessage.includes('expired') ||
                          errorMessage.includes('invalid_access_token') ||
                          errorMessage.includes('access token is missing');

        // If it's not an auth error or we don't have refresh token, don't retry
        if (!isAuthError || !dropboxRefreshToken) {
          break;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
        }
      }
    }

    // If all retries failed, throw the error
    if (lastError) {
      const errorMessage = lastError?.error?.error_summary || lastError.message || String(lastError);
      if (errorMessage.includes('401') || errorMessage.includes('expired') || errorMessage.includes('invalid_access_token')) {
        throw new Error('Dropboxの認証が切れました。再度「Dropbox に接続」ボタンから連携してください。');
      }
      if (errorMessage.includes('access token is missing')) {
        throw new Error('Dropbox access token is missing');
      }
      throw new Error(`Dropbox Error: ${errorMessage}`);
    }

    return NextResponse.json({ 
      success: true, 
      driveResult, 
      dropboxResult,
      message: (googleAccessToken && !skipGoogleDrive) ? 'Google DriveとDropboxに保存しました' : 'Dropboxにノートのみ保存しました'
    });
  } catch (error: any) {
    console.error('Save error:', error);
    return NextResponse.json({ error: error.message || 'Save failed' }, { status: 500 });
  }
}
