export type LocaleCode = 'en' | 'fr' | 'it' | 'es' | 'ja' | 'ru' | 'de' | 'pt' | 'zh' | 'ko';

export interface LocaleDescriptor {
  code: LocaleCode;
  bcp47: string;
  timezone: string;
  notes?: string;
}

export const SUPPORTED_LOCALES: readonly LocaleDescriptor[] = [
  { code: 'en', bcp47: 'en-US', timezone: 'America/New_York' },
  { code: 'fr', bcp47: 'fr-FR', timezone: 'Europe/Paris' },
  { code: 'it', bcp47: 'it-IT', timezone: 'Europe/Rome' },
  { code: 'es', bcp47: 'es-ES', timezone: 'Europe/Madrid' },
  { code: 'ja', bcp47: 'ja-JP', timezone: 'Asia/Tokyo' },
  { code: 'ru', bcp47: 'ru-RU', timezone: 'Europe/Moscow' },
  { code: 'de', bcp47: 'de-DE', timezone: 'Europe/Berlin' },
  {
    code: 'pt',
    bcp47: 'pt-PT',
    timezone: 'Europe/Lisbon',
    notes: 'TBD — verify against live app (pt-PT vs pt-BR); see Task 14',
  },
  { code: 'zh', bcp47: 'zh-CN', timezone: 'Asia/Shanghai' },
  { code: 'ko', bcp47: 'ko-KR', timezone: 'Asia/Seoul' },
] as const;

export function getLocale(code: LocaleCode): LocaleDescriptor {
  const found = SUPPORTED_LOCALES.find((l) => l.code === code);
  if (!found) throw new Error(`Unknown locale: ${code}`);
  return found;
}
