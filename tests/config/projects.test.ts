import { test, expect } from '@playwright/test';
import { buildProjects } from '../../src/config/projects';

const env = { basicAuthUser: 'u', basicAuthPass: 'p', baseUrl: 'https://x.test' };

test('builds 60 uniquely named projects (10 × 3 × 2)', () => {
  const projects = buildProjects(env);
  expect(projects).toHaveLength(60);
  expect(new Set(projects.map((p) => p.name)).size).toBe(60);
});

test('project name format is locale__device__engine', () => {
  const projects = buildProjects(env);
  expect(projects.some((p) => p.name === 'ru__iphone17pro__webkit')).toBe(true);
});

test('each project carries metadata and locale/creds in use', () => {
  const projects = buildProjects(env);
  const p = projects.find((x) => x.name === 'ja__s20__chromium')!;
  expect(p.metadata).toEqual({ locale: 'ja', device: 's20', engine: 'chromium' });
  expect((p.use as { locale: string }).locale).toBe('ja-JP');
  expect((p.use as { browserName: string }).browserName).toBe('chromium');
  expect((p.use as { httpCredentials: unknown }).httpCredentials).toEqual({
    username: 'u',
    password: 'p',
  });
});
