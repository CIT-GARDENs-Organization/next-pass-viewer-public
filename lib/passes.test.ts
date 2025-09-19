import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getPasses } from './passes';

const passesPath = path.join(process.cwd(), 'data', 'passes.json');

describe('getPasses', () => {
  beforeEach(async () => {
    await fs.writeFile(passesPath, '[]\n', 'utf8');
  });

  afterAll(async () => {
    await fs.writeFile(passesPath, '[]\n', 'utf8');
  });

  it('環境変数未設定時にフォールバック計算を行う', async () => {
    const { data, source } = await getPasses({
      standardTime: new Date('2025-01-01T00:00:00.000Z'),
      viewLength: 3,
      satelliteNames: [],
    });

    expect(source).toBe('fallback');
    expect(data.length).toBeGreaterThan(0);
  });

  it('衛星名フィルタを適用する', async () => {
    const { data } = await getPasses({
      standardTime: new Date('2025-01-01T00:00:00.000Z'),
      viewLength: 3,
      satelliteNames: ['NOAA 19'],
    });

    expect(data.length).toBeGreaterThan(0);
    expect(data.every((pass) => pass.satellites.name === 'NOAA 19')).toBe(true);
  });

  it('計算結果をpasses.jsonに保存する', async () => {
    await getPasses({
      standardTime: new Date('2025-01-01T00:00:00.000Z'),
      viewLength: 2,
      satelliteNames: [],
    });

    const stored = JSON.parse(await fs.readFile(passesPath, 'utf8')) as unknown[];
    expect(Array.isArray(stored)).toBe(true);
    expect(stored.length).toBeGreaterThan(0);
  });
});
