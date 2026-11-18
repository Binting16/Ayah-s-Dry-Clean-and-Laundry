/**
 * Format amount into Philippine Pesos (₱)
 * @param {number} amount
 * @returns {string}
 */
export function formatPHP(amount) {
  const num = Number(amount) || 0;
  return '₱' + Math.round(num).toLocaleString('en-PH');
}

/**
 * Calculates suggested laundry price based on weight, service type, and rates
 * @param {number} weight
 * @param {'regular'|'express'} type
 * @param {{ regular: number, express: number }} rates
 * @returns {number}
 */
export function computePrice(weight, type, rates) {
  const w = parseFloat(weight) || 0;
  if (w <= 0) return 0;
  const rate = type === 'express' ? (rates?.express || 35) : (rates?.regular || 20);
  return Math.round(w * rate);
}
