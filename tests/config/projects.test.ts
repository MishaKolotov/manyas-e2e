import { test, expect } from '@playwright/test';
import { buildProjects } from '../../src/config/projects';

test('buildProjects returns 60 projects (10 × 3 × 2)', () => {
  const projects = buildProjects({
    basicAuthUser: 'u',
    basicAuthPass: 'p',
    baseUrl: 'https://x.test',
    surveyPath: '/s/',
    featureFlags: 'a=1',
  });
  expect(projects).toHaveLength(60);
});

test('project name format is locale__device__engine', () => {
  const projects = buildProjects({
    basicAuthUser: 'u',
    basicAuthPass: 'p',
    baseUrl: 'https://x.test',
    surveyPath: '/s/',
    featureFlags: 'a=1',
  });
  expect(projects).toContainEqual(
    expect.objectContaining({ name: 'ru__iphone17__webkit' }),
  );
});

test('each project carries metadata with locale, device, engine', () => {
  const projects = buildProjects({
    basicAuthUser: 'u',
    basicAuthPass: 'p',
    baseUrl: 'https://x.test',
    surveyPath: '/s/',
    featureFlags: 'a=1',
  });
  const p = projects.find((x) => x.name === 'ja__s20e__chromium')!;
  expect(p.metadata).toEqual({ locale: 'ja', device: 's20e', engine: 'chromium' });
  expect((p.use as any).locale).toBe('ja-JP');
  expect((p.use as any).browserName).toBe('chromium');
  expect((p.use as any).httpCredentials).toEqual({ username: 'u', password: 'p' });
});
