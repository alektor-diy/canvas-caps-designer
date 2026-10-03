# CanvasCapsDesigner UI review — v0.2.0

## Design direction

CanvasCapsDesignerのデザイン編集画面を再設計。紙色の背景、深いチャコール、ライムのアクセント、独自のキーボードイラストとキー描画で一貫した表現にしています。画像素材やアイコンパッケージを追加せず、イラストとアイコンはSVGで描画しています。

## Self-review and iterations

1. 最初の実装を1280 × 720で確認。空状態のイラストがFlexboxで縮み、画像読込ツールが画面下に隠れたため、イラストの縮小を抑制し、低い画面用のツール密度を調整。
2. テンプレートを配置して確認。キーが表のセルのように見えたため、実データの形状を維持しつつ、インセットと陰影を加えたキー描画へ修正。
3. 390 × 844で確認。ツールバーの文字がはみ出したため、狭い画面ではプレビュー操作を読み上げラベル付きのアイコン表示に変更。
4. アートワークの読込・数値編集・プレビューを確認。長い浮動小数点表示を3桁に整理。プレビューでは画像をキー形状にクリップし、編集用ラベルを隠して作品を見やすく改善。プレビュー開始時にはキーの範囲に合わせて表示。
5. 重要な操作にフォーカス表示と読み上げラベルを設定。製造サイズ超過は読める文字サイズで表示。reduced-motion設定に対応。

## Verification

- TypeScript build: passed.
- Vitest: all 9 existing model tests passed.
- Production Vite build: passed.
- Browser: template placement, key addition, manufacturing-size warning, Undo, artwork upload, position/size input, PPI warning, preview switching, valid CCAP import with 68 keys and image, recovery from autosave verified.
- Mobile toolbar overflow corrected and visually rechecked at 390 × 844.
- Browser console: no errors during the checked interactions.
- Save control executes without a displayed application error. The in-app browser did not expose the download event, so the downloaded CCAP payload could not be independently inspected through browser automation. The existing JSZip export path and CCAP v1 format remain in place; object URL revocation is delayed to avoid cancelling download initiation.

## Quality assessment

独自性、視覚的一貫性、制作フローの明瞭さ、操作のフィードバック、画面サイズへの適応を基準に反復調整しました。賞の審査を受けていないため、Awwwards・Webby・FWAの受賞水準を満たすという客観的な認定はしていません。

Google Fontsを読み込めない環境でもシステムフォントで動作します。画像・プロジェクトの処理と保存は従来どおりブラウザ内で行います。

## Navigation and copy corrections

- 装飾的なキャッチコピーを削除。空状態は操作説明と開始ボタンのみ表示。
- 01／02／03をクリック可能なフェーズナビゲーションに変更。選択状態はデータの有無ではなく、現在開いているフェーズを示す。
- キャンバス上のキー／アートワーク／完成プレビュー切替を削除。フェーズに応じて左側のツールとキャンバスの編集対象が切り替わる。画像未読込でもアートワークフェーズに移動できる。
- ISO Enterのアイコンはclip-path方式から、輪郭と内側を描くSVGに置換。全体がボタン内に収まることを確認。
- 空プロジェクトでの全フェーズ移動、レイアウトに戻ってのISO Enter追加をブラウザで確認。プレビューは読み取り専用。

## Preview visibility corrections

- 背景を暗い無彩色に変更し、キー輪郭を暗い外縁と明るい細線の二重表示に変更。ズーム時も線幅は画面上で一定。
- 画像の色を変更する白い透過オーバーレイを取り除き、白い下地の上に元画像を描画。透明部分と画像未配置部分も背景から区別できる。
- プレビュー下部に「画像はイメージです。実物の色味・質感・仕上がりとは異なる場合があります。」を常時表示。
- 画像未配置、および白・背景に近い暗色・透明部分を含むPNGで各キーの輪郭を実画面確認。
