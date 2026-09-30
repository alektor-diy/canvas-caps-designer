# Canvas caps Designer

ブラウザ内でキーレイアウトと1枚のアートワーク配置を編集し、CCAP v1として保存する静的Webアプリです。製造形状や製造用データは扱いません。画像はアップロードされず、IndexedDBを含めクライアント内で処理されます。

## バージョンと変更履歴

現在のバージョンは **v0.1.0（初版）** です。利用者に影響する機能や操作の変更は、細かな反復修正をまとめたうえで [CHANGELOG.md](./CHANGELOG.md) に記録します。リリース時は `package.json` とアプリ内のバージョン表示も更新します。

## 開発

Node.jsを用意し、リポジトリでCorepack経由で以下を実行します。`pnpm`コマンドのPATH登録や管理者権限は不要です。

```sh
corepack pnpm@11.19.0 install
corepack pnpm@11.19.0 dev
```

## ビルド

```sh
corepack pnpm@11.19.0 build
corepack pnpm@11.19.0 preview
```

成果物は`dist/`です。Viteのbaseは相対パスなのでGitHub Pagesのプロジェクトサイトに対応します。

## GitHub Pages

GitHubリポジトリの **Settings → Pages → Build and deployment → GitHub Actions** を選択してください。`main`へのpushで`.github/workflows/pages.yml`がビルドしてPagesへ公開します。初回のみActionsがPagesへデプロイできる権限を確認します。

## 主なライブラリ

- React / React DOM: 画面UI
- TypeScript: 型検査
- Vite: 開発サーバーと静的ビルド
- JSZip: CCAP ZIPコンテナの読込・保存
- Vitest: 純粋ロジックのテスト

## 構成

- `src/model.ts`: CCAP型、u/mm変換、スナップ、キー形状、衝突・外形・サイズ・PPI計算、CCAP検証
- `src/ui.tsx`: Designer UI、編集操作、ファイル入出力、IndexedDB復旧
- `src/templates.json`: JSONで拡張できるテンプレートデータ
- `src/style.css`: 1画面型デスクトップUI

## キャンバス操作

- ホイール: ポインター位置を中心にズーム
- 右ボタンを押したままドラッグ: キャンバスを移動
- 左ドラッグ: キー範囲選択、キーや画像の移動
- 「全体表示」: 初期の作業領域全体に戻す
- 完成プレビューでもホイールズームと右ドラッグ / Space+左ドラッグで移動
- 編集対象を「キー / アートワーク」で切替。選択中の対象を前面に表示
- アートワークのプロパティで編集時の透過モードと0.25u位置スナップを切替
- キーラベル: キャンバスのズームにかかわらず画面上の読みやすい大きさで表示
- Ctrl+C / Ctrl+V: キーをコピーし、マウス位置に表示されるプレビューをクリックして配置（Escで取消）

## データ形式

`.ccap`は`project.json`と元形式の`artwork.*`を含むZIPです。自動保存は1枠のIndexedDBを使い、約1秒のデバウンス後に更新します。
