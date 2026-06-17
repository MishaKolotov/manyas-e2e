import { test, expect } from '@playwright/test';
import { normalizeText } from '../../src/utils/normalize';

test('strips <br/> and <br> to a single space', () => {
  expect(normalizeText('Improve my<br/>health for life')).toBe('Improve my health for life');
  expect(normalizeText('a<br>b')).toBe('a b');
});

test('collapses newlines, tabs and repeated spaces, then trims', () => {
  expect(normalizeText('How long\ndoes it\t take?')).toBe('How long does it take?');
  expect(normalizeText('  Walking   ')).toBe('Walking');
});

test('replaces non-breaking spaces with normal spaces', () => {
  expect(normalizeText('12,99 €')).toBe('12,99 €');
});

test('returns empty string for empty/whitespace input', () => {
  expect(normalizeText('   ')).toBe('');
});
