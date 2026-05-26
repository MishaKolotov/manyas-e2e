import { test as base } from '@playwright/test';
import type { LocaleCode } from '../config/locales';
import { loadTranslations, type Translations } from '../utils/i18n-loader';

export interface ProjectMeta {
  locale: LocaleCode;
  device: string;
  engine: string;
}

export const test = base.extend<{
  i18n: Translations;
  projectMeta: ProjectMeta;
}>({
  projectMeta: async (_fixtures, use, testInfo) => {
    const md = testInfo.project.metadata as ProjectMeta | undefined;
    if (!md?.locale) {
      throw new Error(
        `Project '${testInfo.project.name}' has no metadata.locale. Did you go through buildProjects()?`,
      );
    }
    await use(md);
  },
  i18n: async ({ projectMeta }, use) => {
    await use(loadTranslations(projectMeta.locale as LocaleCode));
  },
});

export const expect = base.expect;
