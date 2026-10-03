import { describe, it, expect } from 'vitest';
import {
  bounds, canPlace, collides, effectivePpi, manufacturableSize, newDesign,
  nextKeyPosition, snapMm, toMm, toU, validateDesign, Key, UNIT_MM,
  clampKeyPosition, clampKeyGroupDelta,
  resizeArtworkFromCorner, resizeArtworkWithSnap,
  artworkSlots, setArtwork,
  artworkCorners, moveArtworkWithSnap,
  keyCenter, keyCorners, keyPath, moveKeysWithSnap,
} from './model';

const key = (id: string, type: Key['type'], xMm: number, yMm: number): Key => ({ id, type, xMm, yMm, rotation: 0 });

describe('design geometry', () => {
  it('rotates around the unchanged center and measures the rotated outline', () => {
    const original = key('a', '2u', 40, 40), rotated = { ...original, rotation: 90 };
    expect(keyCenter(rotated)).toEqual(keyCenter(original));
    expect(bounds([rotated]).width).toBeCloseTo(17);
    expect(bounds([rotated]).height).toBeCloseTo(34);
    expect(keyCorners({ ...original, type: 'ISO Enter', rotation: 33 })).toHaveLength(6);
    expect(keyPath(rotated)).toContain(' L ');
  });

  it('uses polygon overlap rather than bounding boxes, allowing corner and edge contact', () => {
    const a = { ...key('a', '1u', 41.5, 41.5), rotation: 45 };
    const diagonal = { ...key('b', '1u', 59.5, 59.5), rotation: 45 };
    expect(bounds([a]).maxX).toBeGreaterThan(bounds([diagonal]).minX);
    expect(bounds([a]).maxY).toBeGreaterThan(bounds([diagonal]).minY);
    expect(collides(a, diagonal)).toBe(false);
    expect(collides(a, { ...diagonal, xMm: 50, yMm: 50 })).toBe(true);
    expect(collides(key('c', '1u', 0, 0), key('d', '1u', 17, 17))).toBe(false);
    expect(collides(key('c', '1u', 0, 0), key('d', '1u', 17, 0))).toBe(false);
    const iso = { ...key('i', 'ISO Enter', 40, 40), rotation: 90 };
    expect(collides(iso, iso)).toBe(true);
    expect(canPlace({ ...key('edge', '1u', 0, 0), rotation: 45 }, [])).toBe(false);
  });

  it('preserves a fractional center phase during grid movement and bypasses snapping with Shift', () => {
    const a = { ...key('a', '1.25u', 40.123, 40.456), rotation: 27 };
    const result = moveKeysWithSnap([a], [], 5, 7);
    expect(result.keys[0].xMm).toBeCloseTo(44.373);
    expect(result.keys[0].yMm).toBeCloseTo(48.956);
    expect(result.grid).toBe(true);
    const free = moveKeysWithSnap([a], [], 5.123, 7.456, UNIT_MM, 5, false);
    expect(free.keys[0].xMm).toBeCloseTo(45.246);
    expect(free.keys[0].yMm).toBeCloseTo(47.912);
    expect(free.grid).toBe(false);
    expect(free.corner).toBeNull();
  });

  it('snaps a rotated key corner exactly to another key, including a rotated target', () => {
    const target = { ...key('b', '1u', 40, 40), rotation: 15 };
    const source = { ...key('a', '1u', 100, 100), rotation: 45 };
    const point = keyCorners(target)[2], moving = keyCorners(source)[0];
    const result = moveKeysWithSnap([source], [target], point[0] - moving[0] + .2, point[1] - moving[1] - .1, UNIT_MM, 2);
    expect(result.placed).toBe(true);
    expect(result.corner).toMatchObject({ sourceId: 'a', sourceCorner: 0, targetId: 'b', targetCorner: 2 });
    expect(keyCorners(result.keys[0])[0][0]).toBeCloseTo(point[0]);
    expect(keyCorners(result.keys[0])[0][1]).toBeCloseTo(point[1]);
    expect(result.keys[0].rotation).toBe(45);
    expect(collides(result.keys[0], target)).toBe(false);
  });

  it('rejects corner snaps that cause overlap and preserves group spacing', () => {
    const a = key('a', '1u', 60, 60), b = key('b', '1u', 40, 40);
    const invalid = moveKeysWithSnap([a], [b], -20, -20, UNIT_MM, 1);
    expect(invalid.placed).toBe(false);
    expect(invalid.corner).toBeNull();
    const c = { ...key('c', '1u', 90, 60), rotation: 30 };
    const group = moveKeysWithSnap([a, c], [b], -3.2, 9.1);
    expect(group.keys[1].xMm - group.keys[0].xMm).toBeCloseTo(30);
    expect(group.keys[1].yMm - group.keys[0].yMm).toBeCloseTo(0);
    expect(group.keys[1].rotation).toBe(30);
  });

  it('validates finite key angles in CCAP while preserving legacy zero-angle keys', () => {
    const design = newDesign();
    design.keys = [{ ...key('12345678-1234-4123-8123-123456789012', '1u', 40, 40), rotation: -32.75 }];
    expect(() => validateDesign(design)).not.toThrow();
    expect(() => validateDesign({ ...design, keys: [{ ...design.keys[0], rotation: NaN }] })).toThrow();
  });

  it('reports the actual resize snap axis and moving corner, including rotated images', () => {
    const art = { file: 'art.png', xMm: 10, yMm: 20, widthMm: 100, heightMm: 50, rotation: 0 };
    expect(resizeArtworkWithSnap(art, 2, { x: 130, y: 80 }).snap).toEqual({ axis: 'y', corner: 2 });
    expect(resizeArtworkWithSnap(art, 2, { x: 127.5, y: 78.75 }).snap).toEqual({ axis: 'x', corner: 2 });
    expect(resizeArtworkWithSnap(art, 2, { x: 130, y: 80 }, UNIT_MM, false).snap).toBeNull();
    for (const corner of [0, 1, 2, 3] as const) {
      const result = resizeArtworkWithSnap({ ...art, rotation: 31 }, corner, { x: 130, y: 80 });
      expect(result.snap?.corner).toBe(corner);
      const coordinate = artworkCorners(result.artwork)[corner][result.snap!.axis];
      expect(coordinate / 4.25).toBeCloseTo(Math.round(coordinate / 4.25));
    }
  });

  it('snaps the right and bottom edges independently without resizing artwork', () => {
    const art = { file: 'art.png', xMm: 10.2, yMm: 11, widthMm: 21, heightMm: 13.4, rotation: 0 };
    const result = moveArtworkWithSnap(art, 0, 0);
    expect(result.snap).toEqual({ x: 1, y: 2 });
    expect(result.artwork.xMm + art.widthMm).toBeCloseTo(29.75);
    expect(result.artwork.yMm + art.heightMm).toBeCloseTo(25.5);
    expect(result.artwork).toMatchObject({ widthMm: 21, heightMm: 13.4, rotation: 0 });
    expect(art.xMm).toBe(10.2);
  });

  it('uses each of the four visible corners of a rotated image on the project grid', () => {
    const art = { file: 'art.png', xMm: 10.2, yMm: 11, widthMm: 43.3, heightMm: 27.7, rotation: 23 };
    const corners = artworkCorners(art);
    for (const corner of [0, 1, 2, 3] as const) {
      const result = moveArtworkWithSnap(art, 60 - corners[corner].x, 84 - corners[corner].y, 24);
      expect(result.snap).toEqual({ x: corner, y: corner });
      const moved = artworkCorners(result.artwork)[corner];
      expect(moved.x).toBeCloseTo(60);
      expect(moved.y).toBeCloseTo(84);
      expect(result.artwork).toMatchObject({ widthMm: art.widthMm, heightMm: art.heightMm, rotation: 23 });
    }
  });

  it('keeps the current corner near a tie but switches when another is clearly closer', () => {
    const art = { file: 'art.png', xMm: 1.2, yMm: 0, widthMm: 2, heightMm: 10, rotation: 0 };
    const initial = moveArtworkWithSnap(art, 0, 0);
    expect(initial.snap?.x).toBe(1);
    const sticky = moveArtworkWithSnap(art, 0, 0, UNIT_MM, { x: 0, y: 0 });
    expect(sticky.snap?.x).toBe(0);
    const switched = moveArtworkWithSnap(art, .5, 0, UNIT_MM, sticky.snap);
    expect(switched.snap?.x).toBe(1);
  });

  it('moves freely with snapping disabled and forgets the previous snap', () => {
    const art = { file: 'art.png', xMm: 10.2, yMm: 11, widthMm: 21, heightMm: 13.4, rotation: 35 };
    const result = moveArtworkWithSnap(art, .123, -.456, UNIT_MM, { x: 2, y: 3 }, false);
    expect(result.snap).toBeNull();
    expect(result.artwork.xMm).toBeCloseTo(10.323);
    expect(result.artwork.yMm).toBeCloseTo(10.544);
    expect(result.artwork.rotation).toBe(35);
  });

  it('accepts legacy single-image projects and projects with only the second image', () => {
    const legacy = newDesign();
    legacy.artwork = { file: 'artwork.png', xMm: 0, yMm: 0, widthMm: 40, heightMm: 20, rotation: 0 };
    expect(() => validateDesign(legacy)).not.toThrow();
    expect(artworkSlots(legacy)).toEqual([legacy.artwork, null]);
    const pair = setArtwork(legacy, 1, { ...legacy.artwork, file: 'artwork-2.webp', xMm: 80, rotation: 30 });
    expect(() => validateDesign(pair)).not.toThrow();
    const remaining = setArtwork(pair, 0, null);
    expect(() => validateDesign(remaining)).not.toThrow();
    expect(artworkSlots(remaining)).toEqual([null, pair.artwork2]);
    expect(legacy.artwork).not.toBeNull();
  });

  it('rejects invalid second image geometry and duplicate image filenames', () => {
    const design = newDesign();
    design.artwork = { file: 'artwork.png', xMm: 0, yMm: 0, widthMm: 40, heightMm: 20, rotation: 0 };
    expect(() => validateDesign(setArtwork(design, 1, { ...design.artwork!, file: 'artwork-2.png', widthMm: 0 }))).toThrow();
    expect(() => validateDesign(setArtwork(design, 1, { ...design.artwork!, file: 'artwork-2.svg' }))).toThrow();
    expect(() => validateDesign(setArtwork(design, 1, { ...design.artwork! }))).toThrow('重複');
    expect(() => validateDesign({ ...design, frontArtwork: 0 })).not.toThrow();
    expect(() => validateDesign({ ...design, frontArtwork: 1 })).not.toThrow();
    expect(() => validateDesign({ ...design, frontArtwork: 2 })).toThrow('重なり順');
  });

  it('resizes artwork while fixing the opposite corner and preserving its aspect ratio', () => {
    const art = { file: 'art.png', xMm: 10, yMm: 20, widthMm: 100, heightMm: 50, rotation: 0 };
    const resized = resizeArtworkFromCorner(art, 2, { x: 130, y: 80 }, UNIT_MM, false);
    expect(resized).toMatchObject({ xMm: 10, yMm: 20, widthMm: 120, heightMm: 60 });
    expect(resized.widthMm / resized.heightMm).toBe(art.widthMm / art.heightMm);
  });

  it('keeps the opposite corner fixed for rotated artwork and snaps the moving corner to the world grid', () => {
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
    const moving = rotate(resized.widthMm / 2, resized.heightMm / 2);
    const coordinates = [nextCenter.x + moving.x, nextCenter.y + moving.y];
    expect(coordinates.some(value => Math.abs(value / 4.25 - Math.round(value / 4.25)) < 1e-8)).toBe(true);
  });

  it('uses either the X or Y grid while preserving aspect ratio for all four corners', () => {
    const art = { file: 'art.png', xMm: 10, yMm: 20, widthMm: 100, heightMm: 50, rotation: 0 };
    for (const corner of [0, 1, 2, 3] as const) {
      const sx = corner === 0 || corner === 3 ? -1 : 1, sy = corner < 2 ? -1 : 1;
      const fixed = { x: sx < 0 ? 110 : 10, y: sy < 0 ? 70 : 20 };
      const resized = resizeArtworkFromCorner(art, corner, { x: fixed.x + sx * 120, y: fixed.y + sy * 60 });
      const x = sx < 0 ? resized.xMm : resized.xMm + resized.widthMm;
      const y = sy < 0 ? resized.yMm : resized.yMm + resized.heightMm;
      expect(resized.widthMm / resized.heightMm).toBeCloseTo(2);
      expect(sx < 0 ? resized.xMm + resized.widthMm : resized.xMm).toBeCloseTo(fixed.x);
      expect(sy < 0 ? resized.yMm + resized.heightMm : resized.yMm).toBeCloseTo(fixed.y);
      expect([x, y].some(v => Math.abs(v / 4.25 - Math.round(v / 4.25)) < 1e-8)).toBe(true);
    }
    // At this pointer, the Y grid requires the smaller change in scale.
    const ySnap = resizeArtworkFromCorner(art, 2, { x: 130, y: 80 });
    expect(ySnap.yMm + ySnap.heightMm).toBeCloseTo(80.75);
    const xSnap = resizeArtworkFromCorner(art, 2, { x: 127.5, y: 78.75 });
    expect(xSnap.xMm + xSnap.widthMm).toBeCloseTo(127.5);
  });

  it('scales continuously without snapping and prevents inverted sizes', () => {
    const art = { file: 'art.png', xMm: 10, yMm: 20, widthMm: 100, heightMm: 50, rotation: 0 };
    const first = resizeArtworkFromCorner(art, 2, { x: 130.1, y: 80.05 }, UNIT_MM, false);
    const next = resizeArtworkFromCorner(art, 2, { x: 130.2, y: 80.1 }, UNIT_MM, false);
    expect(first.widthMm).toBeCloseTo(120.1);
    expect(next.widthMm - first.widthMm).toBeCloseTo(.1);
    expect(next.widthMm / next.heightMm).toBeCloseTo(2);
    const small = resizeArtworkFromCorner(art, 2, { x: -100, y: -100 });
    expect(small.widthMm).toBeGreaterThan(0);
    expect(small.heightMm).toBeGreaterThan(0);
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
