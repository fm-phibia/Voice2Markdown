import { Dropbox } from 'dropbox';

export async function saveToDropbox(filename: string, content: string) {
  const accessToken = process.env.DROPBOX_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('DROPBOX_ACCESS_TOKEN is not set in environment variables');
  }

  const dbx = new Dropbox({ accessToken, fetch: fetch });
  
  try {
    const response = await dbx.filesUpload({
      path: `/Obsidian/Journals/${filename}.md`,
      contents: content,
      mode: { '.tag': 'overwrite' }
    });
    return response;
  } catch (error) {
    console.error('Dropbox upload error:', error);
    throw error;
  }
}
