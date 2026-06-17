/**
 * Normalize a string for exact translation comparison. Applied to BOTH the
 * value scraped from the DOM and the value from the spreadsheet, so that
 * spreadsheet markup (`<br/>`, literal `\n`) lines up with rendered text.
 */
export function normalizeText(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, ' ') // <br/> and <br> → space
    .replace(/ /g, ' ') // non-breaking space → space
    .replace(/[\n\r\t]+/g, ' ') // newlines/tabs → space
    .replace(/\s+/g, ' ') // collapse runs of whitespace
    .trim();
}
