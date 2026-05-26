import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

export function runI18nCheck(xlsxPath: string, metaPath: string): void {
  if (!fs.existsSync(xlsxPath)) {
    throw new Error(
      `Source xlsx not found at ${xlsxPath}. Place WWLI Onboarding Localisation.xlsx in repo root.`,
    );
  }
  if (!fs.existsSync(metaPath)) {
    throw new Error(
      `Translation fixtures missing (${metaPath}). Run \`npm run i18n:import\` to regenerate fixtures.`,
    );
  }
  const xlsxMtime = fs.statSync(xlsxPath).mtimeMs;
  const metaMtime = fs.statSync(metaPath).mtimeMs;
  if (xlsxMtime > metaMtime) {
    throw new Error(
      `Source xlsx is newer than translation fixtures. Run \`npm run i18n:import\` to regenerate fixtures.`,
    );
  }
}

if (import.meta.url && fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
  const xlsxPath = path.join(process.cwd(), 'WWLI Onboarding Localisation.xlsx');
  const metaPath = path.join(process.cwd(), 'tests/fixtures/i18n/_meta.json');
  try {
    runI18nCheck(xlsxPath, metaPath);
    console.log('i18n fixtures up-to-date.');
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
