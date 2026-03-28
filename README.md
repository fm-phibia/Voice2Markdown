# Voice2Markdown

録音、文字起こし（Gemini AI）、そしてクラウド保存（Google Drive & Dropbox）をシームレスに行うためのWebアプリケーションです。

## 主な機能

- **高精度な文字起こし**: Gemini 1.5 Flash (または Pro) を使用し、一言一句正確なテキスト化を実現。
- **スリープ防止機能**: 長時間の録音でも画面が消えないよう Wake Lock API と無音オーディオ再生を搭載。
- **クラウド連携**: 
  - 音声ファイル (.webm) を Google Drive に自動保存。
  - 文字起こしテキスト (.md) を Dropbox (Obsidian 連携など) に自動保存。
- **カスタム辞書**: 専門用語や固有名詞を登録して文字起こし精度を向上。
- **アクセス制限**: 許可されたメールアドレスのみが利用できるセキュリティ機能。

## セットアップ手順

### 1. 必要条件

- Node.js 18.x 以上
- npm または yarn
- Google Cloud プロジェクト (Google Drive API 用)
- Dropbox デベロッパーアプリ (Dropbox API 用)
- Gemini API キー

### 2. インストール

```bash
git clone <repository-url>
cd voice2markdown
npm install
```

### 3. 環境変数の設定

`.env.example` を `.env.local` にコピーし、必要な値を設定してください。

```bash
cp .env.example .env.local
```

#### 設定項目:

| 変数名 | 説明 |
| :--- | :--- |
| `NEXT_PUBLIC_GEMINI_API_KEY` | Gemini API キー |
| `APP_URL` | アプリケーションのベースURL (例: `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` | Google OAuth クライアントID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth クライアントシークレット |
| `GOOGLE_DRIVE_FOLDER_ID` | 音声保存先のフォルダID (任意) |
| `DROPBOX_CLIENT_ID` | Dropbox アプリキー |
| `DROPBOX_CLIENT_SECRET` | Dropbox アプリシークレット |
| `DROPBOX_SAVE_PATH` | Dropbox 内の保存パス (例: `/Obsidian/Journals/`) |
| `ALLOWED_EMAILS` | 許可するメールアドレス (カンマ区切り。空なら全員許可) |

### 4. OAuth の設定

#### Google Cloud Console
1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成。
2. **Google Drive API** を有効化。
3. **OAuth 同意画面** を設定。
4. **認証情報** から「OAuth 2.0 クライアント ID」を作成。
   - 承認済みのリダイレクト URI に `${APP_URL}/api/auth/google/callback` を追加。

#### Dropbox App Console
1. [Dropbox Developers](https://www.dropbox.com/developers/apps) でアプリを作成。
2. **Permissions** で `files.content.write` を有効化。
3. **Settings** の「Redirect URIs」に `${APP_URL}/api/auth/dropbox/callback` を追加。

### 5. アプリの起動

#### 開発モード（ローカル）
```bash
npm run dev
```

#### 本番モード（ローカル）
```bash
npm run build
npm run start
```

#### Docker を使った起動

##### 前提条件
- Docker と Docker Compose がインストールされていること
- `.env` ファイルに環境変数が設定されていること

##### 本番環境で起動
```bash
# イメージをビルドして起動
docker compose up -d --build app

# ログを確認
docker compose logs -f app

# 停止
docker compose down
```

##### 開発環境で起動
```bash
# 開発モードで起動（ホットリロード有効）
docker compose --profile dev up dev

# 停止
docker compose --profile dev down
```

**注意事項:**
- Docker環境では `.env` ファイルから環境変数が自動的に読み込まれます
- 本番環境はポート `3000` で起動します
- 開発環境ではソースコードの変更がリアルタイムに反映されます

## ライセンス

MIT
