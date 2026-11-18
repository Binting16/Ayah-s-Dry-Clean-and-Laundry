import { formatPHP } from '../utils/currency.js';

/**
 * Render dashboard summary stat cards
 * @param {Object} state
 */
export function renderStats(state) {
  const container = document.getElementById('statsSection');
  if (!container) return;

  const activeOrders = state.allActive || [];
  const unpaidCount = activeOrders.filter(t => !t.paid).length;
  const collectedTotal = activeOrders.filter(t => t.paid).reduce((sum, t) => sum + (Number(t.price) || 0), 0);
  const outstandingTotal = activeOrders.filter(t => !t.paid).reduce((sum, t) => sum + (Number(t.price) || 0), 0);

  container.innerHTML = `
    <div class="stat-card">
      <span class="stat-value" id="statTotal">${activeOrders.length}</span>
      <span class="stat-label">Active Orders</span>
    </div>
    <div class="stat-card stat-unpaid">
      <span class="stat-value" id="statUnpaid">${unpaidCount}</span>
      <span class="stat-label">Unpaid Orders</span>
    </div>
    <div class="stat-card">
      <span class="stat-value" id="statCollected">${formatPHP(collectedTotal)}</span>
      <span class="stat-label">Collected</span>
    </div>
    <div class="stat-card stat-outstanding">
      <span class="stat-value" id="statOutstanding">${formatPHP(outstandingTotal)}</span>
      <span class="stat-label">Outstanding</span>
    </div>
  `;
}
