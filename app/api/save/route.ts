import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { saveToDropbox } from '@/lib/dropbox';
import { saveToGoogleDrive } from '@/lib/gdrive';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const googleAccessToken = cookieStore.get('google_access_token')?.value;

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const transcription = formData.get('transcription') as string;
    
    if (!audioFile || !transcription) {
      return NextResponse.json({ error: 'Missing audio or transcription' }, { status: 400 });
    }

    const date = new Date();
    const filenameBase = `VoiceMemo_${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}`;
    
    const audioFilename = `${filenameBase}.webm`;
    const mdFilename = filenameBase;

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Google Drive
    let driveResult = null;
    if (googleAccessToken) {
      try {
        driveResult = await saveToGoogleDrive(audioFilename, buffer, audioFile.type || 'audio/webm', googleAccessToken);
      } catch (e: any) {
        console.warn('Failed to save to Google Drive:', e.message);
        throw new Error(`Google Drive Error: ${e.message}`);
      }
    } else {
      console.warn('Google Drive access token not found. Skipping Google Drive upload.');
    }

    // Format Markdown
    const markdownContent = `# Voice Memo: ${date.toLocaleString()}\n\n## Transcription\n\n${transcription}\n\n---\n*Audio saved to Google Drive: ${audioFilename}*`;

    // Upload to Dropbox
    let dropboxResult = null;
    try {
      dropboxResult = await saveToDropbox(mdFilename, markdownContent);
    } catch (e: any) {
      console.warn('Failed to save to Dropbox:', e.message);
      throw new Error(`Dropbox Error: ${e.message}`);
    }

    return NextResponse.json({ 
      success: true, 
      driveResult, 
      dropboxResult,
      message: googleAccessToken ? 'Saved to Google Drive and Dropbox' : 'Saved to Dropbox only (Google Drive not connected)'
    });
  } catch (error: any) {
    console.error('Save error:', error);
    return NextResponse.json({ error: error.message || 'Save failed' }, { status: 500 });
  }
}
