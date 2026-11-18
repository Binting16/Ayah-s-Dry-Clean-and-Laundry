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
 * Generates sequential transaction display codes (A1-A999, B1-B999, etc.)
 * @param {number} counter 1-indexed transaction counter
 * @returns {string}
 */
export function generateCode(counter) {
  const safeCounter = Math.max(1, parseInt(counter, 10) || 1);
  const block = Math.floor((safeCounter - 1) / 999) + 1;
  const number = ((safeCounter - 1) % 999) + 1;
  return toLetters(block) + number;
}
