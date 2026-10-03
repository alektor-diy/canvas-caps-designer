import { describe, expect, it } from 'vitest';
import { newDesign } from './model';
import { previewFrame, previewSvg } from './preview';

describe('preview export', () => {
  it('renders both images in a stable order with independent placement and rotation', () => {
    const design = newDesign();
    design.artwork = { file: 'artwork.png', xMm: 0, yMm: 0, widthMm: 40, heightMm: 20, rotation: 0 };
    design.artwork2 = { file: 'artwork-2.png', xMm: 80, yMm: 10, widthMm: 30, heightMm: 20, rotation: 90 };
    const { markup } = previewSvg(design, ['data:image/png;base64,left', 'data:image/png;base64,right']);
    expect(markup.match(/<image /g)).toHaveLength(2);
    expect(markup.indexOf('base64,left')).toBeLessThan(markup.indexOf('base64,right'));
    expect(markup).toContain('rotate(90 95 20)');
    design.frontArtwork = 0;
    const reversed = previewSvg(design, ['data:image/png;base64,left', 'data:image/png;base64,right']).markup;
    expect(reversed.indexOf('base64,right')).toBeLessThan(reversed.indexOf('base64,left'));
    design.artwork = null;
    const remaining = previewSvg(design, ['', 'data:image/png;base64,right']).markup;
    expect(remaining.match(/<image /g)).toHaveLength(1);
    expect(remaining).toContain('base64,right');
    expect(remaining).not.toContain('base64,left');
  });

  it('fits offset keys and ISO Enter without cropping, using the project pitch', () => {
    const design = newDesign();
    design.layout.unitMm = 20;
    design.keys = [{ id: 'iso', type: 'ISO Enter', xMm: 100, yMm: 60, rotation: 0 }];
    expect(previewFrame(design)).toEqual({ minX: 85, minY: 45, width: 60, height: 70 });
    const svg = previewSvg(design, '');
    expect(svg.width).toBe(1371);
    expect(svg.height).toBe(1600);
    expect(svg.markup).toContain('M 100 60 h 30 v 40 h -25 v -20 h -5 Z');
    expect(svg.markup).not.toContain('<image');
  });

  it('embeds the original image, rotation and clipping with an opaque white key base', () => {
    const design = newDesign();
    design.keys = [{ id: 'key', type: '1u', xMm: 0, yMm: 0, rotation: 0 }];
    design.artwork = { file: 'artwork.png', xMm: -10, yMm: -5, widthMm: 40, heightMm: 30, rotation: 35 };
    const { markup } = previewSvg(design, 'data:image/png;base64,test');
    expect(markup).toContain('href="data:image/png;base64,test"');
    expect(markup).toContain('rotate(35 10 10)');
    expect(markup).toContain('clip-path="url(#preview-keycaps)"');
    expect(markup).toContain('fill="#fff"');
    expect(markup).not.toContain('<text');
    expect(markup).not.toContain('opacity="0.45"');
  });

  it('exports an empty project as a valid, bounded background image', () => {
    const svg = previewSvg(newDesign(), '');
    expect(svg.width).toBe(1600);
    expect(svg.height).toBe(1600);
    expect(svg.markup).not.toContain('NaN');
    expect(svg.markup).not.toContain('Infinity');
  });
});
