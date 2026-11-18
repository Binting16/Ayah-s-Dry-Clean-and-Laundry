import { formatPHP } from '../utils/currency.js';
import { formatISO, parseDate } from '../utils/dates.js';

/**
 * Render the sticky bottom bar: Collected Today
 * @param {Object} state
 */
export function renderFooter(state) {
  const amountEl = document.getElementById('footerCollectedToday');
  const countEl = document.getElementById('footerPaidCount');
  if (!amountEl) return;

  const todayStr = formatISO(new Date());

  // All non-deleted orders
  const all = [...(state.allActive || []), ...(state.allReleased || [])];

  const paidToday = all.filter(t => {
    if (!t.paid) return false;
    if (String(t.recordStatus).toUpperCase() === 'DELETED') return false;

    // Check if paid today or created today
    const pDate = t.paidAt ? formatISO(t.paidAt) : null;
    const cDate = t.date || (t.createdAt ? formatISO(t.createdAt) : null);

    return pDate === todayStr || cDate === todayStr;
  });

  const totalCollected = paidToday.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
  const paidCount = paidToday.length;

  amountEl.textContent = formatPHP(totalCollected);
  if (countEl) {
    countEl.textContent = `(${paidCount} paid order${paidCount === 1 ? '' : 's'})`;
  }
}
