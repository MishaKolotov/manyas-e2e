import { test, expect } from '@playwright/test';
import { DEVICES, getDevice } from '../../src/config/devices';

test('exposes the three target devices', () => {
  expect(DEVICES.map((d) => d.code)).toEqual(['iphone17pro', 'iphone16promax', 's20']);
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

test('iphone17pro viewport is 402x874', () => {
  const d = getDevice('iphone17pro');
  expect(d.viewport).toEqual({ width: 402, height: 874 });
});

test('getDevice("nope") throws', () => {
  expect(() => getDevice('nope' as never)).toThrow(/Unknown device/);
});
