import type { Project } from '@playwright/test';
import { SUPPORTED_LOCALES } from './locales';
import { DEVICES } from './devices';
import type { AppEnv } from './env';

const ENGINES = ['chromium', 'webkit'] as const;
type Engine = (typeof ENGINES)[number];

export interface MatrixProject extends Project {
  metadata: { locale: string; device: string; engine: Engine };
}

export function buildProjects(env: AppEnv): MatrixProject[] {
  const list: MatrixProject[] = [];
  for (const loc of SUPPORTED_LOCALES) {
    for (const dev of DEVICES) {
      for (const eng of ENGINES) {
        list.push({
          name: `${loc.code}__${dev.code}__${eng}`,
          use: {
            viewport: dev.viewport,
            deviceScaleFactor: dev.deviceScaleFactor,
            userAgent: dev.userAgent,
            hasTouch: dev.hasTouch,
            isMobile: dev.isMobile,
            browserName: eng,
            locale: loc.bcp47,
            timezoneId: loc.timezone,
            httpCredentials: {
              username: env.basicAuthUser,
              password: env.basicAuthPass,
            },
            baseURL: env.baseUrl,
            trace: 'on-first-retry',
            video: 'retain-on-failure',
            screenshot: 'only-on-failure',
          },
          metadata: { locale: loc.code, device: dev.code, engine: eng },
        });
      }
    }
  }
  return list;
}
