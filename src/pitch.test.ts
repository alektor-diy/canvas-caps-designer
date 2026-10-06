import { describe, expect, it } from 'vitest';
import { bounds, canPlace, changePitch, keyCenter, manufacturableSize, manufacturingSizeGuide, newDesign, snapMm, STANDARD_UNIT_MM, validateDesign } from './model';
import { previewFrame, previewSvg } from './preview';

const id = '12345678-1234-4123-8123-123456789abc';
describe('project pitch', () => {
  it('converts rotated and ISO keys without changing their layout in u', () => {
    const original = newDesign();
    original.keys = [
      { id, type: 'ISO Enter', xMm: 34, yMm: 34, rotation: 27.5 },
      { id: '12345678-1234-4123-8123-123456789abd', type: '2.25u', xMm: 102, yMm: 68, rotation: -15 },
    ];
    const snapshot = structuredClone(original);
    const converted = changePitch(original, STANDARD_UNIT_MM);
    expect(original).toEqual(snapshot);
    converted.keys.forEach((key, i) => {
      const oldCenter = keyCenter(original.keys[i]);
      const newCenter = keyCenter(key, STANDARD_UNIT_MM);
      expect(newCenter.x / STANDARD_UNIT_MM).toBeCloseTo(oldCenter.x / 17);
      expect(newCenter.y / STANDARD_UNIT_MM).toBeCloseTo(oldCenter.y / 17);
      expect(key.rotation).toBe(original.keys[i].rotation);
      expect(key.type).toBe(original.keys[i].type);
      expect(key.id).toBe(original.keys[i].id);
      expect(canPlace(key, converted.keys, STANDARD_UNIT_MM)).toBe(true);
    });
    const restored = changePitch(converted, 17);
    restored.keys.forEach((key, i) => {
      expect(key.xMm).toBeCloseTo(original.keys[i].xMm);
      expect(key.yMm).toBeCloseTo(original.keys[i].yMm);
    });
    expect(changePitch(original, 17)).toBe(original);
    expect(() => changePitch(original, 0)).toThrow();
  });

  it('approximates both images while preserving their aspect ratio, rotation and order', () => {
    const original = newDesign();
    original.artwork = { file: 'artwork.png', xMm: -7.777, yMm: 12.345, widthMm: 53.333, heightMm: 21.111, rotation: 33 };
    original.artwork2 = { file: 'artwork-2.webp', xMm: 80.123, yMm: 50.555, widthMm: 31.117, heightMm: 47.778, rotation: -12 };
    original.frontArtwork = 0;
    const converted = changePitch(original, STANDARD_UNIT_MM);
    [converted.artwork!, converted.artwork2!].forEach((art, i) => {
      const old = [original.artwork!, original.artwork2!][i];
      for (const field of ['xMm', 'yMm', 'widthMm'] as const) {
        expect(Math.abs(art[field] - old[field] * STANDARD_UNIT_MM / 17)).toBeLessThanOrEqual(.005 + 1e-9);
      }
      expect(art.widthMm / art.heightMm).toBeCloseTo(old.widthMm / old.heightMm);
      expect(art.rotation).toBe(old.rotation);
      expect(art.file).toBe(old.file);
    });
    expect(converted.frontArtwork).toBe(0);
    expect(changePitch(newDesign(), STANDARD_UNIT_MM).artwork).toBeNull();
    expect(changePitch(newDesign(), STANDARD_UNIT_MM)).not.toHaveProperty('artwork2');
  });

  it.each([17, STANDARD_UNIT_MM])('retains pitch through JSON round trips and uses it for snapping and preview (%s)', unit => {
    const original = newDesign();
    original.keys = [{ id, type: '1u', xMm: 34, yMm: 51, rotation: 0 }];
    const converted = changePitch(original, unit);
    const restored = JSON.parse(JSON.stringify(converted));
    expect(() => validateDesign(restored)).not.toThrow();
    expect(restored.layout.unitMm).toBe(unit);
    expect(snapMm(unit * 2.28, unit)).toBeCloseTo(unit * 2.25);
    const extent = bounds(restored.keys, unit), frame = previewFrame(restored);
    expect(extent.width).toBeCloseTo(unit);
    expect(frame.minX + frame.width).toBeGreaterThan(extent.maxX);
    expect(previewSvg(restored, '').markup).toContain(`h ${unit} v ${unit}`);
  });

  it.each([
    [17, 14, 14, true], [17, 15, 5, true], [17, 15, 5.01, false],
    [17, 14.01, 14, false], [17, 13, 13, true],
    [STANDARD_UNIT_MM, 13, 13, true], [STANDARD_UNIT_MM, 13.001, 13, false],
    [STANDARD_UNIT_MM, 13, 13.001, false], [STANDARD_UNIT_MM, 15, 5, false],
  ])('checks the correct manufacturing limit for %s mm and %su × %su', (unit, width, height, ok) => {
    const keys = [
      { id: 'a', type: '1u' as const, xMm: 0, yMm: 0, rotation: 0 },
      { id: 'b', type: '1u' as const, xMm: (width - 1) * unit, yMm: (height - 1) * unit, rotation: 0 },
    ];
    const size = manufacturableSize(keys, unit);
    expect(size.ok).toBe(ok);
    expect(size.widthU).toBeCloseTo(width);
    expect(size.heightU).toBeCloseTo(height);
    expect(manufacturingSizeGuide(unit)).toBe(unit === 17 ? '14u × 14u または 15u × 5u' : '13u × 13u');
  });
});
