import { describe, it, expect } from 'vitest';
import {
  bounds, canPlace, collides, effectivePpi, manufacturableSize, newDesign,
  nextKeyPosition, snapMm, toMm, toU, validateDesign, Key, UNIT_MM,
  clampKeyPosition, clampKeyGroupDelta,
  resizeArtworkFromCorner,
} from './model';

const key = (id: string, type: Key['type'], xMm: number, yMm: number): Key => ({ id, type, xMm, yMm, rotation: 0 });

describe('design geometry', () => {
  it('resizes artwork while fixing the opposite corner and preserving its aspect ratio', () => {
    const art = { file: 'art.png', xMm: 10, yMm: 20, widthMm: 100, heightMm: 50, rotation: 0 };
    const resized = resizeArtworkFromCorner(art, 2, { x: 130, y: 80 }, UNIT_MM, false);
    expect(resized).toMatchObject({ xMm: 10, yMm: 20, widthMm: 120, heightMm: 60 });
    expect(resized.widthMm / resized.heightMm).toBe(art.widthMm / art.heightMm);
  });

  it('keeps the opposite corner fixed for rotated artwork and snaps resize increments', () => {
    const art = { file: 'art.png', xMm: 10, yMm: 20, widthMm: 100, heightMm: 50, rotation: 30 };
    const rad = art.rotation * Math.PI / 180;
    const rotate = (x: number, y: number) => ({ x: x * Math.cos(rad) - y * Math.sin(rad), y: x * Math.sin(rad) + y * Math.cos(rad) });
    const center = { x: art.xMm + art.widthMm / 2, y: art.yMm + art.heightMm / 2 };
    const beforeAnchor = rotate(-art.widthMm / 2, -art.heightMm / 2);
    const anchor = { x: center.x + beforeAnchor.x, y: center.y + beforeAnchor.y };
    const pointer = { x: 160, y: 100 };
    const resized = resizeArtworkFromCorner(art, 2, pointer, UNIT_MM, true);
    const nextCenter = { x: resized.xMm + resized.widthMm / 2, y: resized.yMm + resized.heightMm / 2 };
    const afterAnchor = rotate(-resized.widthMm / 2, -resized.heightMm / 2);
    expect(nextCenter.x + afterAnchor.x).toBeCloseTo(anchor.x, 8);
    expect(nextCenter.y + afterAnchor.y).toBeCloseTo(anchor.y, 8);
    expect(resized.widthMm / resized.heightMm).toBeCloseTo(art.widthMm / art.heightMm, 8);
    expect((resized.widthMm - art.widthMm) / (UNIT_MM * 0.25)).toBeCloseTo(Math.round((resized.widthMm - art.widthMm) / (UNIT_MM * 0.25)), 8);
  });

  it('converts and snaps coordinates', () => {
    expect(toMm(2.25)).toBe(38.25);
    expect(toU(38.25)).toBe(2.25);
    expect(snapMm(5.7)).toBe(4.25);
  });

  it('places new keys next to the selected or last key', () => {
    expect(nextKeyPosition('1u', [])).toEqual({ xMm: 0, yMm: 0 });
    const keys = [key('a', '1u', 0, 0), key('b', '1u', 51, 0)];
    expect(nextKeyPosition('1u', keys, 'a')).toEqual({ xMm: 17, yMm: 0 });
    expect(nextKeyPosition('1u', keys)).toEqual({ xMm: 68, yMm: 0 });
    expect(nextKeyPosition('1u', [keys[0], key('c', '1u', 17, 0)], 'a')).toEqual({ xMm: 34, yMm: 0 });
  });

  it('rejects overlap and placements beyond the visible work area', () => {
    const a = key('a', '1u', 0, 0);
    expect(collides(a, key('b', '1u', 8.5, 0))).toBe(true);
    expect(canPlace(key('b', '1u', 8.5, 0), [a])).toBe(false);
    expect(canPlace(key('right-edge', '1u', 19 * UNIT_MM, 0), [])).toBe(true);
    expect(canPlace(key('past-right', '1u', 19.25 * UNIT_MM, 0), [])).toBe(false);
    expect(canPlace(key('bottom-edge', '1u', 0, 14 * UNIT_MM), [])).toBe(true);
    expect(canPlace(key('past-bottom', '1u', 0, 14.25 * UNIT_MM), [])).toBe(false);
  });

  it('checks the complete ISO Enter occupancy against work area bounds', () => {
    expect(canPlace(key('iso-edge', 'ISO Enter', 18.5 * UNIT_MM, 13 * UNIT_MM), [])).toBe(true);
    expect(canPlace(key('iso-outside', 'ISO Enter', 18.75 * UNIT_MM, 13 * UNIT_MM), [])).toBe(false);
    const iso = key('i', 'ISO Enter', 0, 0);
    expect(collides(iso, key('edge', '1u', 25.5, 17))).toBe(false);
    expect(collides(iso, key('p', '1u', 17, 17))).toBe(true);
  });

  it('clamps dragged keys and groups to all four work area edges', () => {
    const one = key('one', '1u', 0, 0);
    expect(clampKeyPosition(one, 30 * UNIT_MM, 30 * UNIT_MM)).toMatchObject({ xMm: 19 * UNIT_MM, yMm: 14 * UNIT_MM });
    const pair = [key('left', '1u', 18 * UNIT_MM, 0), key('right', '1u', 19 * UNIT_MM, 0)];
    expect(clampKeyGroupDelta(pair, 5 * UNIT_MM, 0)).toEqual({ xMm: 0, yMm: 0 });
    expect(clampKeyGroupDelta(pair, -30 * UNIT_MM, -30 * UNIT_MM)).toEqual({ xMm: -18 * UNIT_MM, yMm: 0 });
  });

  it('measures layout extent and manufacturing limits', () => {
    expect(bounds([key('i', 'ISO Enter', 0, 0)]).width).toBe(25.5);
    expect(manufacturableSize([key('a', '1u', 0, 0)]).ok).toBe(true);
  });

  it('calculates PPI and validates CCAP v1', () => {
    expect(effectivePpi(3000, 254)).toBe(300);
    expect(() => validateDesign(newDesign())).not.toThrow();
    expect(() => validateDesign({ ...newDesign(), formatVersion: 2 })).toThrow();
  });
});
