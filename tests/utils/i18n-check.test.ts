import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runI18nCheck } from '../../src/utils/i18n-check';

function tempScenario(): { xlsx: string; meta: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-check-'));
  const xlsx = path.join(dir, 'src.xlsx');
  const meta = path.join(dir, '_meta.json');
  return { xlsx, meta, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('i18n:check passes when meta newer than xlsx', () => {
  const s = tempScenario();
  try {
    fs.writeFileSync(s.xlsx, 'x');
    // sleep to ensure different mtimes
    const t = Date.now();
    while (Date.now() - t < 50) {}
    fs.writeFileSync(s.meta, '{}');
    expect(() => runI18nCheck(s.xlsx, s.meta)).not.toThrow();
  } finally {
    s.cleanup();
  }
});

test('i18n:check fails when xlsx newer than meta', () => {
  const s = tempScenario();
  try {
    fs.writeFileSync(s.meta, '{}');
    const t = Date.now();
    while (Date.now() - t < 50) {}
    fs.writeFileSync(s.xlsx, 'x');
    expect(() => runI18nCheck(s.xlsx, s.meta)).toThrow(/i18n:import/);
  } finally {
    s.cleanup();
  }
});

test('i18n:check fails when meta missing', () => {
  const s = tempScenario();
  try {
    fs.writeFileSync(s.xlsx, 'x');
    expect(() => runI18nCheck(s.xlsx, s.meta)).toThrow(/i18n:import/);
  } finally {
    s.cleanup();
  }
});
