'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Save, Book, Plus, Trash2, AlertCircle, CheckCircle2, Cloud } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

export default function Home() {
  type DictionaryEntry = { word: string; context: string };

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcription, setTranscription] = useState('');
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isDropboxConnected, setIsDropboxConnected] = useState(false);
  
  const [dictionary, setDictionary] = useState<DictionaryEntry[]>([]);
  const [newWord, setNewWord] = useState('');
  const [newContext, setNewContext] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    const savedDict = localStorage.getItem('voice_dictionary');
    if (savedDict) {
      try {
        const parsed = JSON.parse(savedDict);
        if (Array.isArray(parsed)) {
          const migrated = parsed.map(item => {
            if (typeof item === 'string') {
              return { word: item, context: '' };
            }
            return item;
          });
          setDictionary(migrated);
        }
      } catch (e) {}
    }
    
    checkGoogleStatus();
    checkDropboxStatus();

    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith('.run.app') && !event.origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        if (event.data?.provider === 'google') {
          checkGoogleStatus();
        } else if (event.data?.provider === 'dropbox') {
          checkDropboxStatus();
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const checkGoogleStatus = async () => {
    try {
      const res = await fetch('/api/auth/google/status');
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        setIsGoogleConnected(data.connected);
      }
    } catch (e) {
      console.error('Failed to check Google status', e);
    }
  };

  const checkDropboxStatus = async () => {
    try {
      const res = await fetch('/api/auth/dropbox/status');
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        setIsDropboxConnected(data.connected);
      }
    } catch (e) {
      console.error('Failed to check Dropbox status', e);
    }
  };

  const connectGoogleDrive = async () => {
    try {
      const response = await fetch('/api/auth/google/url');
      if (!response.ok) throw new Error('Failed to get auth URL');
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('サーバーが準備中です。しばらく待ってから再度お試しください。');
      }
      const { url } = await response.json();
      
      const authWindow = window.open(url, 'oauth_popup', 'width=600,height=700');
      if (!authWindow) {
        alert('ポップアップがブロックされました。ポップアップを許可してください。');
      }
    } catch (error: any) {
      console.error('OAuth error:', error);
      alert(error.message || 'Google Driveへの接続に失敗しました。');
    }
  };

  const connectDropbox = async () => {
    try {
      const response = await fetch('/api/auth/dropbox/url');
      if (!response.ok) throw new Error('Failed to get auth URL');
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('サーバーが準備中です。しばらく待ってから再度お試しください。');
      }
      const { url } = await response.json();
      
      const authWindow = window.open(url, 'oauth_popup', 'width=600,height=700');
      if (!authWindow) {
        alert('ポップアップがブロックされました。ポップアップを許可してください。');
      }
    } catch (error: any) {
      console.error('OAuth error:', error);
      alert(error.message || 'Dropboxへの接続に失敗しました。');
    }
  };

  const saveDictionary = (newDict: DictionaryEntry[]) => {
    setDictionary(newDict);
    localStorage.setItem('voice_dictionary', JSON.stringify(newDict));
  };

  const addWord = () => {
    if (newWord.trim() && !dictionary.some(d => d.word === newWord.trim())) {
      saveDictionary([...dictionary, { word: newWord.trim(), context: newContext.trim() }]);
      setNewWord('');
      setNewContext('');
    }
  };

  const removeWord = (word: string) => {
    saveDictionary(dictionary.filter(w => w.word !== word));
  };

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err: any) {
      // Suppress the error if the environment (e.g. iframe) doesn't allow Wake Lock
      console.warn('Wake Lock could not be acquired:', err.message || err);
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
        releaseWakeLock();
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        
        // Auto transcribe
        await transcribeAudio(blob);
      };

      await requestWakeLock();
      mediaRecorder.start(1000); // collect data every second
      setIsRecording(true);
      setRecordingTime(0);
      setTranscription('');
      setTranscriptionError(null);
      setSaveStatus(null);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('マイクへのアクセスに失敗しました。');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        try {
          const base64data = (reader.result as string).split(',')[1];
          
          const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
          
          let systemInstruction = 'あなたはプロの文字起こしアシスタントです。提供された音声を正確に文字起こししてください。\n重要: 出力は文字起こししたテキストのみとし、挨拶や「文字起こししました」などの前置き、後書き、説明は一切含めないでください。';
          if (dictionary.length > 0) {
            const dictString = dictionary.map(d => d.context ? `${d.word} (${d.context})` : d.word).join(', ');
            systemInstruction += `\n以下の固有名詞や専門用語のリストを参考に、文脈に合わせて正しく変換・修正してください：\n${dictString}`;
          }

          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [
              {
                inlineData: {
                  data: base64data,
                  mimeType: blob.type || 'audio/webm',
                }
              },
              '音声の文字起こしのみを出力してください。'
            ],
            config: {
              systemInstruction,
            }
          });

          if (response.text && response.text.trim().length > 0) {
            setTranscription(response.text.trim());
          } else {
            setTranscriptionError('音声から文字を検出できませんでした。');
          }
        } catch (error: any) {
          console.error('Transcription error:', error);
          setTranscriptionError(`文字起こしに失敗しました: ${error.message}`);
        } finally {
          setIsTranscribing(false);
        }
      };
    } catch (error: any) {
      console.error('Transcription error:', error);
      setTranscriptionError(`文字起こしに失敗しました: ${error.message}`);
      setIsTranscribing(false);
    }
  };

  const handleSave = async () => {
    if (!audioBlob || !transcription) return;
    
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('transcription', transcription);

      const response = await fetch('/api/save', {
        method: 'POST',
        body: formData,
      });

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error('サーバーが準備中です。数秒待ってから再度お試しください。');
      }

      if (response.ok) {
        setSaveStatus({ type: 'success', message: data.message || '保存しました！' });
      } else {
        throw new Error(data.error || '保存に失敗しました');
      }
    } catch (error: any) {
      console.error('Save error:', error);
      const errorMessage = error.message;
      setSaveStatus({ type: 'error', message: `保存に失敗しました: ${errorMessage}` });
      
      if (errorMessage.includes('Dropboxの認証が切れました') || errorMessage.includes('Dropbox Error: 401')) {
        setIsDropboxConnected(false);
      }
      if (errorMessage.includes('Google Driveの認証が切れました') || errorMessage.includes('Google Drive Error: 401')) {
        setIsGoogleConnected(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Voice2Markdown</h1>
          <p className="text-zinc-500">録音・文字起こし・クラウド保存</p>
          
          <div className="flex justify-center items-center gap-4 mt-4 flex-wrap">
            {isGoogleConnected ? (
              <button
                onClick={connectGoogleDrive}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-sm font-medium border border-emerald-200 transition-colors cursor-pointer"
                title="Google Drive に再接続する"
              >
                <CheckCircle2 className="w-4 h-4" />
                Google Drive 接続済み
              </button>
            ) : (
              <button
                onClick={connectGoogleDrive}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-zinc-700 hover:bg-zinc-50 text-sm font-medium border border-zinc-200 transition-colors shadow-sm cursor-pointer"
              >
                <Cloud className="w-4 h-4" />
                Google Drive に接続
              </button>
            )}

            {isDropboxConnected ? (
              <button
                onClick={connectDropbox}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-sm font-medium border border-emerald-200 transition-colors cursor-pointer"
                title="Dropbox に再接続する"
              >
                <CheckCircle2 className="w-4 h-4" />
                Dropbox 接続済み
              </button>
            ) : (
              <button
                onClick={connectDropbox}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-zinc-700 hover:bg-zinc-50 text-sm font-medium border border-zinc-200 transition-colors shadow-sm cursor-pointer"
              >
                <Cloud className="w-4 h-4" />
                Dropbox に接続
              </button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Recorder & Dictionary */}
          <div className="space-y-6 md:col-span-1">
            {/* Recorder Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 flex flex-col items-center justify-center space-y-6">
              <div className="text-4xl font-mono font-light tracking-wider text-zinc-800">
                {formatTime(recordingTime)}
              </div>
              
              {isRecording ? (
                <button
                  onClick={stopRecording}
                  className="w-24 h-24 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-colors shadow-sm border border-red-100 cursor-pointer"
                >
                  <Square className="w-8 h-8 fill-current" />
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  disabled={isTranscribing || isSaving}
                  className="w-24 h-24 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white flex items-center justify-center transition-colors shadow-md disabled:opacity-50 cursor-pointer"
                >
                  <Mic className="w-8 h-8" />
                </button>
              )}
              
              <div className="text-sm text-zinc-500 flex items-center gap-2">
                {isRecording ? (
                  <><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> 録音中</>
                ) : (
                  '準備完了'
                )}
              </div>
            </div>

            {/* Dictionary Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 space-y-4">
              <div className="flex items-center gap-2 text-zinc-800 font-medium">
                <Book className="w-5 h-5" />
                <h2>辞書登録</h2>
              </div>
              <p className="text-xs text-zinc-500">
                文字起こし時に優先して認識させたい固有名詞や専門用語を登録します。
              </p>
              
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  placeholder="単語 (例: VJ)"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newContext}
                    onChange={(e) => setNewContext(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addWord()}
                    placeholder="付帯情報 (例: ボイスジャーナル)"
                    className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                  <button
                    onClick={addWord}
                    disabled={!newWord.trim()}
                    className="p-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pt-2">
                {dictionary.map(entry => (
                  <span key={entry.word} className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-100 text-zinc-700 text-xs rounded-md">
                    <span className="font-medium">{entry.word}</span>
                    {entry.context && <span className="text-zinc-500">({entry.context})</span>}
                    <button onClick={() => removeWord(entry.word)} className="text-zinc-400 hover:text-red-500 cursor-pointer ml-1">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {dictionary.length === 0 && (
                  <span className="text-xs text-zinc-400 italic">登録されていません</span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Transcription & Save */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 h-full flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="font-medium text-zinc-800">文字起こし結果</h2>
                  {transcriptionError && (
                    <span className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {transcriptionError}
                    </span>
                  )}
                </div>
                {isTranscribing && (
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    処理中...
                  </div>
                )}
              </div>

              {!transcriptionError && (
                <textarea
                  value={transcription}
                  onChange={(e) => setTranscription(e.target.value)}
                  placeholder="録音を停止すると、ここに文字起こし結果が表示されます。"
                  className="flex-1 w-full p-4 bg-zinc-50 border border-zinc-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-zinc-900 min-h-[300px]"
                  disabled={isTranscribing}
                />
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-zinc-100">
                <div className="flex-1">
                  {saveStatus && (
                    <div className={`flex items-center gap-2 text-sm ${saveStatus.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {saveStatus.type === 'error' && <AlertCircle className="w-4 h-4" />}
                      {saveStatus.message}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleSave}
                  disabled={!transcription || isSaving || isTranscribing}
                  className="w-full sm:w-auto px-6 py-3 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium cursor-pointer"
                >
                  {isSaving ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> 保存中...</>
                  ) : (
                    <><Save className="w-5 h-5" /> クラウドへ保存</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
