import { test, expect } from '../../src/fixtures/i18n.fixture';

test('i18n fixture matches project locale (intro_text_0)', async ({ i18n, projectMeta }) => {
  expect(i18n.locale).toBe(projectMeta.locale);
  // smoke: known key from xlsx (English source)
  const v = i18n.get('intro_text_0');
  expect(v).toBeTruthy();
});
