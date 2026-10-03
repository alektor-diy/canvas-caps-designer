import { useEffect, useRef } from 'react';

const postText = 'CanvasCapsDesignerでキーキャップをデザインしました！\n#CanvasCapsDesigner #自作キーボード';
const postUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(postText)}`;

export function ShareDialog({ filename, onClose }: { filename: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);

  return <dialog ref={dialog} className="modal share-dialog" aria-labelledby="share-title" aria-describedby="share-instructions" onCancel={onClose}>
    <h2 id="share-title">プレビュー画像を添付して投稿</h2>
    <p id="share-instructions">保存したプレビュー画像を、Xの投稿画面にドラッグ＆ドロップして添付してください。画像は自動では添付されません。</p>
    <p>ダウンロードファイル：<strong className="share-filename">{filename}</strong><br/>保存先はブラウザのダウンロード一覧から確認できます。</p>
    <blockquote className="share-copy">{postText}</blockquote>
    <section className="share-notice" aria-labelledby="share-notice-title">
      <h3 id="share-notice-title">投稿前のご確認</h3>
      <p>本サービスで作成した画像を共有する際は、以下の内容を含む画像を投稿しないでください。</p>
      <ul>
        <li>著作権など、第三者の権利を侵害するもの</li>
        <li>公序良俗に反するもの</li>
        <li>成人向け（R-18）の性的な表現</li>
        <li>過度に暴力的・グロテスクな表現</li>
      </ul>
    </section>
    <div>
      <button autoFocus onClick={onClose}>閉じる</button>
      <a className="primary share-link" href={postUrl} target="_blank" rel="noopener noreferrer">Xの投稿画面を開く ↗</a>
    </div>
  </dialog>;
}
