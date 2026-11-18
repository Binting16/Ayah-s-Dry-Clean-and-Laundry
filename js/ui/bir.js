import { formatDateTime, parseDate, getToday, getThisWeek, getThisMonth, formatISO } from '../utils/dates.js';
import { formatPHP } from '../utils/currency.js';
import { exportToCSV } from '../utils/export.js';
import { escapeHtml } from '../utils/sanitize.js';
import { showToast } from './toast.js';
import { printReceipt } from './receipt.js';

let appState = null;
let appDb = null;
let activePeriod = 'annual'; // 'annual' | 'month' | 'week' | 'today'
let currentSubFilter = 'all'; // 'all' | 'completed' | 'deleted'

export function initBir(state, db) {
  appState = state;
  appDb = db;

  renderBirView();
}

export async function renderBirView() {
  const container = document.getElementById('birSection');
  if (!container) return;

  const currentYear = appState.selectedYear || new Date().getFullYear();
  const sheetsUrl = appState.settings.googleSheetsUrl || '';

  // Generate list of selectable years
  const availableYears = [currentYear - 1, currentYear, currentYear + 1];

  container.innerHTML = `
    <div class="bir-header">
      <div class="bir-title">
        <h2>BIR & Financial Records</h2>
        <p>Annual sales recap, audit ledgers, and official BIR accounting data.</p>
      </div>

      <div class="bir-controls">
        <div class="year-select-wrap">
          <label for="birYearSelect">Year</label>
          <select id="birYearSelect" class="year-select">
            ${availableYears.map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
        </div>

        ${sheetsUrl ? `
          <a href="${escapeHtml(sheetsUrl)}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="min-height:36px; padding:6px 14px; font-size:0.85rem;">
            🔗 Open Google Sheet
          </a>
        ` : ''}

        <button class="btn-primary" id="btnBirExportCsv" style="min-height:36px; padding:6px 16px; font-size:0.85rem;">
          📥 Download BIR CSV
        </button>
      </div>
    </div>

    <!-- Period Buttons -->
    <div class="bir-period-nav">
      <button class="bir-period-btn ${activePeriod === 'annual' ? 'is-active' : ''}" data-period="annual">Full Year ${currentYear} (Annual)</button>
      <button class="bir-period-btn ${activePeriod === 'month' ? 'is-active' : ''}" data-period="month">This Month</button>
      <button class="bir-period-btn ${activePeriod === 'week' ? 'is-active' : ''}" data-period="week">This Week</button>
      <button class="bir-period-btn ${activePeriod === 'today' ? 'is-active' : ''}" data-period="today">Today</button>
    </div>

    <!-- Metric Cards -->
    <div class="bir-metrics-grid" id="birMetricsGrid">
      <div style="grid-column: 1/-1; text-align:center; padding:20px; color:var(--ink-secondary);">Loading summary metrics…</div>
    </div>

    <!-- Sub-Filter Pills & Table Header -->
    <div class="bir-subtabs">
      <div class="bir-filter-pills">
        <button class="bir-pill ${currentSubFilter === 'all' ? 'is-active' : ''}" data-filter="all">All Records</button>
        <button class="bir-pill ${currentSubFilter === 'completed' ? 'is-active' : ''}" data-filter="completed">Valid / Active Only</button>
        <button class="bir-pill ${currentSubFilter === 'deleted' ? 'is-active' : ''}" data-filter="deleted">Deleted / Voided Only</button>
      </div>
      <div style="font-size:0.82rem; color:var(--ink-secondary);" id="birTableCount">Showing records</div>
    </div>

    <!-- Audit Ledger Table -->
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Date & Time</th>
            <th>Customer</th>
            <th>Weight</th>
            <th>Service</th>
            <th>Price</th>
            <th>Payment</th>
            <th>Order Status</th>
            <th>Record Status</th>
            <th>Delete Reason</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="birTableBody"></tbody>
      </table>
      <p class="empty-state" id="birEmptyState">No records found for this period.</p>
    </div>
  `;

  // Wire year select
  const yearSel = container.querySelector('#birYearSelect');
  yearSel?.addEventListener('change', async (e) => {
    appState.selectedYear = parseInt(e.target.value, 10);
    showToast(`Loading year ${appState.selectedYear}...`, 'info');
    await loadBirData();
  });

  // Wire period buttons
  container.querySelectorAll('.bir-period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.bir-period-btn').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      activePeriod = btn.dataset.period;
      loadBirData();
    });
  });

  // Wire sub-filter pills
  container.querySelectorAll('.bir-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      container.querySelectorAll('.bir-pill').forEach(p => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      currentSubFilter = pill.dataset.filter;
      loadBirData();
    });
  });

  // Wire CSV Export
  const exportBtn = container.querySelector('#btnBirExportCsv');
  exportBtn?.addEventListener('click', async () => {
    const records = await getFilteredBirRecords();
    if (records.length === 0) {
      showToast('No records available to export for this period.', 'info');
      return;
    }
    const filename = `ayah-laundry-BIR-${appState.selectedYear}-${activePeriod}.csv`;
    exportToCSV(records, filename);
    showToast(`Exported ${records.length} records to BIR CSV.`, 'success');
  });

  await loadBirData();
}

async function getFilteredBirRecords() {
  const currentYear = appState.selectedYear || new Date().getFullYear();
  const all = await appDb.getTransactions(currentYear, true);

  let range = null;
  if (activePeriod === 'today') range = getToday();
  else if (activePeriod === 'week') range = getThisWeek();
  else if (activePeriod === 'month') range = getThisMonth();

  return all.filter(t => {
    // Period date filtering
    if (range) {
      const d = parseDate(t.createdAt);
      if (!d) return false;
      const time = d.getTime();
      if (time < range.start.getTime() || time > range.end.getTime()) return false;
    }

    // Sub-filter
    const isDeleted = String(t.recordStatus).toUpperCase() === 'DELETED';
    if (currentSubFilter === 'completed' && isDeleted) return false;
    if (currentSubFilter === 'deleted' && !isDeleted) return false;

    return true;
  });
}

export async function loadBirData() {
  const records = await getFilteredBirRecords();

  // Metric computations for the selected period
  const totalVolume = records.filter(t => String(t.recordStatus).toUpperCase() !== 'DELETED')
    .reduce((s, t) => s + (Number(t.weight) || 0), 0);
  const grossSales = records.filter(t => String(t.recordStatus).toUpperCase() !== 'DELETED')
    .reduce((s, t) => s + (Number(t.price) || 0), 0);
  const collected = records.filter(t => String(t.recordStatus).toUpperCase() !== 'DELETED' && t.paid)
    .reduce((s, t) => s + (Number(t.price) || 0), 0);
  const unpaid = records.filter(t => String(t.recordStatus).toUpperCase() !== 'DELETED' && !t.paid)
    .reduce((s, t) => s + (Number(t.price) || 0), 0);
  const regularCount = records.filter(t => String(t.recordStatus).toUpperCase() !== 'DELETED' && t.type === 'regular').length;
  const expressCount = records.filter(t => String(t.recordStatus).toUpperCase() !== 'DELETED' && t.type === 'express').length;
  const deletedCount = records.filter(t => String(t.recordStatus).toUpperCase() === 'DELETED').length;

  // Render Metric Cards
  const grid = document.getElementById('birMetricsGrid');
  if (grid) {
    grid.innerHTML = `
      <div class="bir-metric-card">
        <span class="bir-metric-val">${formatPHP(grossSales)}</span>
        <span class="bir-metric-label">Gross Sales</span>
      </div>
      <div class="bir-metric-card">
        <span class="bir-metric-val val-success">${formatPHP(collected)}</span>
        <span class="bir-metric-label">Collected (Paid)</span>
      </div>
      <div class="bir-metric-card">
        <span class="bir-metric-val val-danger">${formatPHP(unpaid)}</span>
        <span class="bir-metric-label">Unpaid Receivables</span>
      </div>
      <div class="bir-metric-card">
        <span class="bir-metric-val">${totalVolume.toFixed(1)} kg</span>
        <span class="bir-metric-label">Total Volume</span>
      </div>
      <div class="bir-metric-card">
        <span class="bir-metric-val">${regularCount} / ${expressCount}</span>
        <span class="bir-metric-label">Regular / Express</span>
      </div>
      <div class="bir-metric-card">
        <span class="bir-metric-val val-muted">${deletedCount}</span>
        <span class="bir-metric-label">Deleted / Voided</span>
      </div>
    `;
  }

  // Render Table
  const body = document.getElementById('birTableBody');
  const empty = document.getElementById('birEmptyState');
  const countEl = document.getElementById('birTableCount');
  if (!body) return;

  if (countEl) countEl.textContent = `Showing ${records.length} records`;

  body.innerHTML = '';
  if (records.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  for (const t of records) {
    const isDeleted = String(t.recordStatus).toUpperCase() === 'DELETED';
    const tr = document.createElement('tr');
    if (isDeleted) tr.className = 'row-deleted';

    tr.innerHTML = `
      <td><span class="code-tag">${t.code}</span></td>
      <td>${formatDateTime(t.createdAt)}</td>
      <td>
        <div class="customer-cell">
          <span class="customer-name">${escapeHtml(t.name)}</span>
          <span class="customer-phone">${t.phone ? escapeHtml(t.phone) : '—'}</span>
        </div>
      </td>
      <td>${t.weight} kg</td>
      <td><span class="badge type-${t.type}">${t.type === 'express' ? 'Express' : 'Regular'}</span></td>
      <td class="price-text">${formatPHP(t.price)}</td>
      <td>
        <span class="badge ${t.paid ? 'badge-audit-active' : 'badge-audit-deleted'}">
          ${t.paid ? 'PAID' : 'UNPAID'}
        </span>
      </td>
      <td>${escapeHtml(t.status || 'Received')}</td>
      <td>
        <span class="badge ${isDeleted ? 'badge-audit-deleted' : 'badge-audit-active'}">
          ${isDeleted ? 'DELETED' : 'ACTIVE'}
        </span>
      </td>
      <td>${escapeHtml(t.deleteReason || '—')}</td>
      <td>
        <button class="icon-btn print-btn" title="Print Receipt">🖨️</button>
      </td>
    `;

    tr.querySelector('.print-btn')?.addEventListener('click', () => {
      printReceipt(t, appState.settings);
    });

    body.appendChild(tr);
  }
}
