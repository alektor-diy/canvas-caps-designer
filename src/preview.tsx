import { renderToStaticMarkup } from 'react-dom/server';
import { artworkOrder, artworkSlots, bounds, Design, keyPath } from './model';

export type PreviewFrame = { minX: number; minY: number; width: number; height: number };

// Used by both the live preview and the PNG export. Keep presentation here so
// exports do not depend on editor selection, external CSS or image object URLs.
export function PreviewScene({ design, imageUrl = '', imageUrls = [imageUrl], frame, pixelWidth }: {
  design: Design; imageUrl?: string; imageUrls?: readonly string[]; frame: PreviewFrame; pixelWidth: number;
}) {
  const paths = design.keys.map(key => keyPath(key, design.layout.unitMm));

  const mmPerPixel = frame.width / Math.max(1, pixelWidth);
  return <g pointerEvents="none">
    <defs>
      <radialGradient id="preview-background" cx="50%" cy="40%" r="72%">
        <stop stopColor="#444c51"/><stop offset="1" stopColor="#30373c"/>
      </radialGradient>
      <clipPath id="preview-keycaps">{paths.map((path, i) => <path key={i} d={path}/>)}</clipPath>
      <filter id="preview-shadow" filterUnits="userSpaceOnUse" x={frame.minX} y={frame.minY} width={frame.width} height={frame.height}>
        <feDropShadow dx="0" dy={3 * mmPerPixel} stdDeviation={3 * mmPerPixel} floodColor="#11171c" floodOpacity=".44"/>
      </filter>
    </defs>
    <rect x={frame.minX} y={frame.minY} width={frame.width} height={frame.height} fill="url(#preview-background)"/>
    <g filter="url(#preview-shadow)">{paths.map((path, i) => <path key={i} d={path} fill="#fff"/>)}</g>
    <g clipPath="url(#preview-keycaps)">{artworkOrder(design).map(i => {const art=artworkSlots(design)[i];return art && imageUrls[i] &&
      <image key={i} href={imageUrls[i]} x={art.xMm} y={art.yMm} width={art.widthMm} height={art.heightMm}
        preserveAspectRatio="none" transform={`rotate(${art.rotation} ${art.xMm + art.widthMm / 2} ${art.yMm + art.heightMm / 2})`}/>
    })}</g>
    {paths.map((path, i) => <g key={i}>
      <path d={path} fill="none" stroke="#20272c" strokeWidth="2.8" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
      <path d={path} fill="none" stroke="#f8fafb" strokeWidth=".9" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
    </g>)}
  </g>;
}

export function previewFrame(design: Design): PreviewFrame {
  const extent = bounds(design.keys, design.layout.unitMm);
  const pad = design.layout.unitMm * .75;
  return { minX: extent.minX - pad, minY: extent.minY - pad,
    width: Math.max(extent.width, design.layout.unitMm) + pad * 2,
    height: Math.max(extent.height, design.layout.unitMm) + pad * 2 };
}

export function previewSvg(design: Design, imageUrl: string | readonly string[]) {
  const frame = previewFrame(design);
  const scale = 1600 / Math.max(frame.width, frame.height);
  const width = Math.max(1, Math.round(frame.width * scale));
  const height = Math.max(1, Math.round(frame.height * scale));
  const markup = renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" width={width} height={height}
    viewBox={`${frame.minX} ${frame.minY} ${frame.width} ${frame.height}`}>
    <PreviewScene design={design} imageUrls={typeof imageUrl === 'string' ? [imageUrl] : imageUrl} frame={frame} pixelWidth={width}/>
  </svg>);
  return { markup, width, height };
}

function imageDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('プレビュー用の画像を読み込めませんでした'));
    reader.readAsDataURL(blob);
  });
}

export async function createPreviewPng(design: Design, artwork: Blob | null | readonly (Blob | null)[]): Promise<Blob> {
  const blobs = Array.isArray(artwork) ? artwork : [artwork as Blob | null];
  const imageUrls = await Promise.all(artworkSlots(design).map(async (art,i) => {
    if (!art) return '';
    if (!blobs[i]) throw new Error('プレビュー用のアートワークがありません');
    return imageDataUrl(blobs[i]!);
  }));
  const { markup, width, height } = previewSvg(design, imageUrls);
  const svgUrl = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    image.src = svgUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('プレビュー画像を生成できませんでした');
    context.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('プレビュー画像を生成できませんでした')), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
