# ベースイメージ: Node.js 24 Alpine
FROM node:24-alpine AS base

# 依存関係のインストールステージ
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 依存関係ファイルをコピー
COPY package.json package-lock.json ./

# 依存関係をインストール
RUN npm ci

# ビルドステージ
FROM base AS builder
WORKDIR /app

# 依存関係をコピー
COPY --from=deps /app/node_modules ./node_modules

# ソースコードをコピー
COPY . .

# 環境変数（ビルド時に必要な場合）
# NEXT_PUBLIC_* はビルド時に埋め込まれるため、必要に応じて ARG で渡す
ARG NEXT_PUBLIC_GEMINI_API_KEY
ENV NEXT_PUBLIC_GEMINI_API_KEY=${NEXT_PUBLIC_GEMINI_API_KEY}

# Next.js アプリケーションをビルド
RUN npm run build

# public フォルダが存在しない場合は作成（空でもコピーエラーを防ぐため）
RUN mkdir -p public

# 本番実行ステージ
FROM base AS runner
WORKDIR /app

# 本番環境を設定
ENV NODE_ENV=production

# セキュリティのため非rootユーザーを作成
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# standalone ビルド出力をコピー
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# public フォルダをコピー
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 非rootユーザーに切り替え
USER nextjs

# ポート3000を公開
EXPOSE 3000

# 環境変数を設定
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# アプリケーションを起動
CMD ["node", "server.js"]
