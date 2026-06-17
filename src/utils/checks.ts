/**
 * Heuristic: does this visible string look like a raw i18n key or an
 * unfilled template placeholder rather than translated copy?
 *
 * A leaked key is all ASCII letters/digits/_/. with at least one `_` or `.`
 * separator (matches snake_case, camelCase, dotted) and length 4–80. The
 * separator requirement excludes single words like "email"/"ok".
 */
const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_.]*[._][a-zA-Z0-9_.]+$/;
const PLACEHOLDER_RE = /\{\{[^}]+\}\}/;

export function looksLikeLeakedKey(text: string): boolean {
  const s = text.trim();
  if (PLACEHOLDER_RE.test(s)) return true;
  if (s.length < 4 || s.length > 80) return false;
  return KEY_RE.test(s);
}
