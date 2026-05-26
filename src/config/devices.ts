export type DeviceCode = 'iphone17' | 'iphone16promax' | 's20e';

export interface DeviceDescriptor {
  code: DeviceCode;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  userAgent: string;
  hasTouch: true;
  isMobile: true;
}

const IPHONE_UA_19 =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/605.1.15';
const IPHONE_UA_18 =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/605.1.15';
const SAMSUNG_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-G781B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

export const DEVICES: readonly DeviceDescriptor[] = [
  {
    code: 'iphone17',
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 3,
    userAgent: IPHONE_UA_19,
    hasTouch: true,
    isMobile: true,
  },
  {
    code: 'iphone16promax',
    viewport: { width: 440, height: 956 },
    deviceScaleFactor: 3,
    userAgent: IPHONE_UA_18,
    hasTouch: true,
    isMobile: true,
  },
  {
    code: 's20e',
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 3,
    userAgent: SAMSUNG_UA,
    hasTouch: true,
    isMobile: true,
  },
] as const;

export function getDevice(code: DeviceCode): DeviceDescriptor {
  const found = DEVICES.find((d) => d.code === code);
  if (!found) throw new Error(`Unknown device: ${code}`);
  return found;
}
