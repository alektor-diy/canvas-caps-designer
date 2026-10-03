import { describe, expect, it } from 'vitest';
import { bounds, keyPath, newDesign } from './model';
import { previewFrame, previewSvg } from './preview';

describe('preview export', () => {
  it.each([0, 90])('limits sharing previews to 1200px with aspect ratio intact (rotation %s)', rotation => {
    const design = newDesign();
    design.keys = [{ id: 'key', type: '2.25u', xMm: 100, yMm: 100, rotation }];
    const normal = previewSvg(design, '');
    const shared = previewSvg(design, '', 1200);
    expect(Math.max(normal.width, normal.height)).toBe(1600);
    expect(Math.max(shared.width, shared.height)).toBe(1200);
    expect(shared.width).toBe(Math.round(normal.width * 1200 / 1600));
    expect(shared.height).toBe(Math.round(normal.height * 1200 / 1600));
    expect(shared.markup.match(/viewBox="[^"]+"/)?.[0]).toBe(normal.markup.match(/viewBox="[^"]+"/)?.[0]);
  });

  it('clips and outlines rotated keys with a frame that includes their full shape', () => {
    const design = newDesign();
    design.keys = [{ id: 'rotated', type: '2u', xMm: 40, yMm: 40, rotation: 37.5 }];
    const path = keyPath(design.keys[0]), frame = previewFrame(design), extent = bounds(design.keys);
    expect(frame.minX).toBeLessThan(extent.minX);
    expect(frame.minY).toBeLessThan(extent.minY);
    expect(frame.minX + frame.width).toBeGreaterThan(extent.maxX);
    expect(frame.minY + frame.height).toBeGreaterThan(extent.maxY);
    expect(previewSvg(design, '').markup.split(`d="${path}"`)).toHaveLength(5);
  });

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
