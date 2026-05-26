import { test, expect } from '@playwright/test';
import { DEVICES, getDevice } from '../../src/config/devices';

test('DEVICES contains iphone17, iphone16promax, s20e', () => {
  const codes = DEVICES.map((d) => d.code).sort();
  expect(codes).toEqual(['iphone16promax', 'iphone17', 's20e']);
});

test('every device has viewport, DSR, UA, hasTouch=true, isMobile=true', () => {
  for (const d of DEVICES) {
    expect(d.viewport.width).toBeGreaterThan(300);
    expect(d.viewport.height).toBeGreaterThan(700);
    expect(d.deviceScaleFactor).toBeGreaterThanOrEqual(2);
    expect(d.userAgent).toMatch(/Mozilla\/5\.0/);
    expect(d.hasTouch).toBe(true);
    expect(d.isMobile).toBe(true);
  }
});

test('iphone17 viewport is 402x874', () => {
  const d = getDevice('iphone17');
  expect(d.viewport).toEqual({ width: 402, height: 874 });
});

test('getDevice("nope") throws', () => {
  expect(() => getDevice('nope' as any)).toThrow(/Unknown device/);
});
