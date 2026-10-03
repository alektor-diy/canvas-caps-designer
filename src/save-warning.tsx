import { useEffect, useRef } from 'react';
import { artworkSlots, Design, effectivePpi } from './model';

export type ResolutionWarning = { slot: number; ppi: number };

// Decode the blobs being saved, rather than relying on the editor's asynchronous
// image-size cache (which may still be loading just after opening a project).
export async function checkSaveResolution(design: Design, blobs: readonly (Blob | null)[]) {
  const warnings: ResolutionWarning[] = [];
  for (const [slot, artwork] of artworkSlots(design).entries()) {
    if (!artwork) continue;
    const blob = blobs[slot];
    if (!blob) throw new Error(`画像${slot + 1}のアートワークがありません`);
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const ppi = effectivePpi(image.naturalWidth, artwork.widthMm);
      if (ppi < 300) warnings.push({ slot, ppi });
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return warnings;
}

export function SaveWarningDialog({ warnings, onDecision }: {
  warnings: ResolutionWarning[];
  onDecision: (continueSaving: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return <dialog ref={dialog} className="modal share-dialog" aria-labelledby="resolution-title" aria-describedby="resolution-description" onCancel={() => onDecision(false)}>
    <h2 id="resolution-title">画像の解像度をご確認ください</h2>
    <p id="resolution-description">推奨解像度（300 PPI）を下回る画像が含まれています。印刷時に、画像や文字が粗く見える場合があります。<br/>この内容を確認して、保存を続けますか？</p>
    <ul className="resolution-list">{warnings.map(({ slot, ppi }) => <li key={slot}>画像{slot + 1}：約{Math.round(ppi)} PPI</li>)}</ul>
    <div>
      <button autoFocus onClick={() => onDecision(false)}>編集に戻る</button>
      <button className="primary" onClick={() => onDecision(true)}>このまま保存</button>
    </div>
  </dialog>;
}
