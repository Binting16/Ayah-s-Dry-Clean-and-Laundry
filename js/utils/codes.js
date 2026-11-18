/**
 * Converts a 1-indexed number to Excel-style column letters (1 -> A, 26 -> Z, 27 -> AA)
 * @param {number} num
 * @returns {string}
 */
export function toLetters(num) {
  let s = '';
  while (num > 0) {
    const rem = (num - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    num = Math.floor((num - 1) / 26);
  }
  return s || 'A';
}

/**
 * Generates year-prefixed sequential codes (e.g. 26-A1, 26-A2 ... 26-A999, 26-B1)
 * @param {number} year e.g. 2026
 * @param {number} counter 1-indexed transaction counter
 * @returns {string} e.g. "26-A1"
 */
export function generateYearCode(year = new Date().getFullYear(), counter = 1) {
  const yy = String(year).slice(-2);
  const safeCounter = Math.max(1, parseInt(counter, 10) || 1);
  const block = Math.floor((safeCounter - 1) / 999) + 1;
  const number = ((safeCounter - 1) % 999) + 1;
  return `${yy}-${toLetters(block)}${number}`;
}

/**
 * Legacy code generator (kept for backwards compatibility)
 * @param {number} counter
 * @returns {string}
 */
export function generateCode(counter) {
  return generateYearCode(new Date().getFullYear(), counter);
}
