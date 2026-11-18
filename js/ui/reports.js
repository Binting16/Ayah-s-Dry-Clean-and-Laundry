import { getToday, getThisWeek, getThisMonth, parseDate } from '../utils/dates.js';
import { formatPHP } from '../utils/currency.js';
import { exportToCSV } from '../utils/export.js';
import { showToast } from './toast.js';

let appState = null;
let appDb = null;
let activePeriod = 'today'; // 'today' | 'week' | 'month' | 'all'

export function initReports(state, db) {
  appState = state;
  appDb = db;

  const container = document.getElementById('reportsSection');
  if (!container) return;

  container.innerHTML = `
    <div class="reports-header">
      <div>
        <h2>Business Summary & BIR Records</h2>
        <p class="table-subtitle">Review revenue, volume, and generate official BIR CSV audit ledgers.</p>
      </div>

      <div class="reports-period-buttons">
        <button class="period-btn is-active" data-period="today">Today</button>
        <button class="period-btn" data-period="week">This Week</button>
        <button class="period-btn" data-period="month">This Month</button>
        <button class="period-btn" data-period="all">All Time</button>
        <button class="btn-primary" id="btnExportCsv" style="min-height:36px; padding:6px 16px; font-size:0.85rem;">
          📥 Download BIR CSV
        </button>
      </div>
    </div>

    <div class="reports-grid" id="reportsMetrics"></div>
  `;

  // Attach button events
  container.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.period-btn').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      activePeriod = btn.dataset.period;
      renderReportsMetrics();
    });
  });

  const exportBtn = document.getElementById('btnExportCsv');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const records = await getPeriodRecords(activePeriod);
      if (records.length === 0) {
        showToast('No records found for the selected period.', 'info');
        return;
      }
      exportToCSV(records, `ayah-laundry-${activePeriod}-records.csv`);
      showToast(`Exported ${records.length} records to CSV.`, 'success');
    });
  }

  renderReportsMetrics();
}

async function getPeriodRecords(period) {
  const all = await appDb.getAllTransactions();
  let range = null;

  if (period === 'today') range = getToday();
  else if (period === 'week') range = getThisWeek();
  else if (period === 'month') range = getThisMonth();

  if (!range) return all;

  const startTime = range.start.getTime();
  const endTime = range.end.getTime();

  return all.filter(t => {
    const d = parseDate(t.createdAt);
    if (!d) return false;
    const time = d.getTime();
    return time >= startTime && time <= endTime;
  });
}

export async function renderReportsMetrics() {
  const metricsContainer = document.getElementById('reportsMetrics');
  if (!metricsContainer) return;

  const records = await getPeriodRecords(activePeriod);

  const totalTx = records.length;
  const regularOrders = records.filter(t => t.type === 'regular' && !t.voided).length;
  const expressOrders = records.filter(t => t.type === 'express' && !t.voided).length;
  const totalWeight = records.filter(t => !t.voided).reduce((sum, t) => sum + (parseFloat(t.weight) || 0), 0);
  const grossSales = records.filter(t => !t.voided).reduce((sum, t) => sum + (Number(t.price) || 0), 0);
  const collected = records.filter(t => !t.voided && t.paid).reduce((sum, t) => sum + (Number(t.price) || 0), 0);
  const unpaid = records.filter(t => !t.voided && !t.paid).reduce((sum, t) => sum + (Number(t.price) || 0), 0);
  const voidedCount = records.filter(t => t.voided).length;

  metricsContainer.innerHTML = `
    <div class="report-item">
      <span class="report-item-val">${totalTx}</span>
      <span class="report-item-label">Total Transactions</span>
    </div>
    <div class="report-item">
      <span class="report-item-val">${totalWeight.toFixed(1)} kg</span>
      <span class="report-item-label">Total Volume</span>
    </div>
    <div class="report-item">
      <span class="report-item-val">${formatPHP(grossSales)}</span>
      <span class="report-item-label">Gross Sales</span>
    </div>
    <div class="report-item">
      <span class="report-item-val" style="color:#15803D;">${formatPHP(collected)}</span>
      <span class="report-item-label">Collected (Paid)</span>
    </div>
    <div class="report-item">
      <span class="report-item-val" style="color:#B91C1C;">${formatPHP(unpaid)}</span>
      <span class="report-item-label">Unpaid Balance</span>
    </div>
    <div class="report-item">
      <span class="report-item-val">${regularOrders} / ${expressOrders}</span>
      <span class="report-item-label">Regular / Express</span>
    </div>
    <div class="report-item">
      <span class="report-item-val" style="color:#64748B;">${voidedCount}</span>
      <span class="report-item-label">Voided Records</span>
    </div>
  `;
}
