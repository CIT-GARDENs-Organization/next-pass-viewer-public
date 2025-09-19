# アーキテクチャ概要

## 構成要素

- **Next.js (App Router)**: `app/` 配下に UI と API ルートを配置。
- **API ルート**: `app/api/time/route.ts` と `app/api/passes/route.ts` がバックエンドロジックを担当。Supabase が利用可能な場合はリモートデータを、未設定の場合は `data/` 配下の静的データを利用して通過情報を計算します。
- **ライブラリ層**: `lib/` 配下に衛星軌道計算や Supabase クライアント初期化などの共通処理を配置。
- **スタイル**: Tailwind CSS とカスタムテーマ (`public/themes/`) を組み合わせてダークモード UI を構築。

## データフロー

1. クライアントから `/api/time` をポーリングしてサーバー時刻を取得。
2. 同時に `/api/passes` から衛星通過情報を取得。
3. Supabase 接続情報が設定されていない場合は `lib/passes.ts` が `data/satellites.json` と `data/groundstations.json` を参照し、衛星 TLE を使用してオンデマンドで通過を計算します。
4. 計算結果は `data/passes.json` に書き出され、次回以降のリクエストで再利用されます。
5. フロントエンドではテーマ設定 (`public/themes/index.ts`) を通じて警告スタイルを切り替え、音声再生などの補助機能を管理します。

## 環境変数

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_KEY`

Supabase を利用しない場合は環境変数の設定は不要です。

## テスト

- `lib/passes.test.ts` に軌道計算のユニットテストを配置。
- `npm run test` (Vitest) で実行します。

## 今後の拡張のヒント

- 追加の地上局や衛星データは `data/` 配下に JSON で追加可能。
