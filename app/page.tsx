'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Cloud, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'not_allowed') {
      setError('このアカウントは許可されていません。');
    }

    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            router.push('/recorder');
            return;
          }
        }
      } catch (e) {
        console.error('Auth check failed', e);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();

    checkGoogleStatus();

    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith('.run.app') && !event.origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        if (event.data?.provider === 'google') {
          router.push('/recorder');
        }
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        setError(event.data.message || '認証に失敗しました。');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [router, searchParams]);

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

  const connectGoogleDrive = async () => {
    setError(null);
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
        setError('ポップアップがブロックされました。ポップアップを許可してください。');
      }
    } catch (error: any) {
      console.error('OAuth error:', error);
      setError(error.message || 'Google Driveへの接続に失敗しました。');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-zinc-100 space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Voice2Markdown</h1>
          <p className="text-zinc-500">録音・文字起こし・クラウド保存</p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2 justify-center text-left">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="space-y-4 pt-4">
          <p className="text-sm text-zinc-600">
            利用するにはGoogleアカウントでログインしてください。
          </p>
          <button
            onClick={connectGoogleDrive}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 font-medium transition-colors shadow-sm cursor-pointer"
          >
            <Cloud className="w-5 h-5" />
            Googleでログイン
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
