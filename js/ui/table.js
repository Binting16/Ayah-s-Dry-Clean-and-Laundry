import { STATUS_FLOW, VOID_REASONS } from '../config.js';
import { formatDate, formatDateTime, parseDate } from '../utils/dates.js';
import { formatPHP } from '../utils/currency.js';
import { escapeHtml } from '../utils/sanitize.js';
import { showToast } from './toast.js';
import { showModal } from './modal.js';
import { printReceipt } from './receipt.js';

let appState = null;
let appDb = null;

export function initTable(state, db) {
  appState = state;
  appDb = db;

  const toolbar = document.getElementById('tableToolbar');
  if (toolbar) {
    toolbar.innerHTML = `
      <div class="table-header-info">
        <h2>Transactions</h2>
        <p class="table-subtitle" id="tableSubtitle"></p>
      </div>

      <div class="table-filters">
        <div class="date-filter-group">
          <label>From</label>
          <input type="date" id="dateFilterFrom">
          <label>To</label>
          <input type="date" id="dateFilterTo">
          <button class="date-clear-btn" id="dateFilterClear" title="Clear dates">✕</button>
        </div>
        <input id="search" type="search" placeholder="Search name, phone, code...">
      </div>
    `;
  }

  // Add tabs container before table if not present
  let tabsContainer = document.getElementById('tableTabs');
  if (!tabsContainer) {
    tabsContainer = document.createElement('div');
    tabsContainer.id = 'tableTabs';
    tabsContainer.className = 'tabs';
    tabsContainer.setAttribute('role', 'tablist');

    const tableSection = document.getElementById('tableSection');
    const tableWrap = tableSection ? tableSection.querySelector('.table-wrap') : null;
    if (tableWrap) {
      tableSection.insertBefore(tabsContainer, tableWrap);
    }
  }

  tabsContainer.innerHTML = `
    <button class="tab is-active" data-tab="active">Active <span class="tab-count" id="countActive">0</span></button>
    <button class="tab" data-tab="released">Released <span class="tab-count" id="countReleased">0</span></button>
    <button class="tab" data-tab="voided">Voided <span class="tab-count" id="countVoided">0</span></button>
  `;

  // Wire tabs
  tabsContainer.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      appState.currentTab = btn.dataset.tab;
      renderTable(appState);
    });
  });

  // Wire search
  const searchInput = document.getElementById('search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      appState.searchQuery = e.target.value.trim().toLowerCase();
      renderTable(appState);
    });
  }

  // Wire date filters
  const dateFrom = document.getElementById('dateFilterFrom');
  const dateTo = document.getElementById('dateFilterTo');
  const dateClear = document.getElementById('dateFilterClear');

  if (dateFrom && dateTo) {
    const handleDateChange = () => {
      appState.dateFilter.from = dateFrom.value ? new Date(dateFrom.value + 'T00:00:00') : null;
      appState.dateFilter.to = dateTo.value ? new Date(dateTo.value + 'T23:59:59') : null;
      renderTable(appState);
    };

    dateFrom.addEventListener('change', handleDateChange);
    dateTo.addEventListener('change', handleDateChange);

    if (dateClear) {
      dateClear.addEventListener('click', () => {
        dateFrom.value = '';
        dateTo.value = '';
        appState.dateFilter.from = null;
        appState.dateFilter.to = null;
        renderTable(appState);
      });
    }
  }

  renderTable(state);
}

export function renderTable(state) {
  const currentTab = state.currentTab || 'active';
  const query = state.searchQuery || '';
  const dateFrom = state.dateFilter.from;
  const dateTo = state.dateFilter.to;

  // Filter tab list
  let sourceList = [];
  if (currentTab === 'released') {
    sourceList = state.allReleased || [];
  } else if (currentTab === 'voided') {
    sourceList = state.allVoided || [];
  } else {
    sourceList = state.allActive || [];
  }

  // Apply search and date range
  const filtered = sourceList.filter(t => {
    if (query) {
      const matchCode = (t.code || '').toLowerCase().includes(query);
      const matchName = (t.name || '').toLowerCase().includes(query);
      const matchPhone = (t.phone || '').includes(query);
      if (!matchCode && !matchName && !matchPhone) return false;
    }

    if (dateFrom || dateTo) {
      const d = parseDate(t.createdAt);
      if (d) {
        const time = d.getTime();
        if (dateFrom && time < dateFrom.getTime()) return false;
        if (dateTo && time > dateTo.getTime()) return false;
      }
    }

    return true;
  });

  // Update tab counters
  const countActiveEl = document.getElementById('countActive');
  const countReleasedEl = document.getElementById('countReleased');
  const countVoidedEl = document.getElementById('countVoided');
  if (countActiveEl) countActiveEl.textContent = (state.allActive || []).length;
  if (countReleasedEl) countReleasedEl.textContent = (state.allReleased || []).length;
  if (countVoidedEl) countVoidedEl.textContent = (state.allVoided || []).length;

  // Update active tab buttons
  document.querySelectorAll('#tableTabs .tab').forEach(b => {
    b.classList.toggle('is-active', b.dataset.tab === currentTab);
  });

  // Update subtitle
  const subtitleEl = document.getElementById('tableSubtitle');
  if (subtitleEl) {
    if (currentTab === 'released') {
      subtitleEl.textContent = 'Orders completed and released to customers.';
    } else if (currentTab === 'voided') {
      subtitleEl.textContent = 'Voided and cancelled records kept for BIR auditing compliance.';
    } else {
      subtitleEl.textContent = 'Current in-progress drop-offs (Received, Ongoing, Finished).';
    }
  }

  // Update Table Header
  const head = document.getElementById('txHead');
  if (head) {
    if (currentTab === 'voided') {
      head.innerHTML = `
        <tr>
          <th>Code</th><th>Date</th><th>Customer</th><th>Weight</th>
          <th>Service</th><th>Price</th><th>Void Reason</th><th>Void Date</th><th>Actions</th>
        </tr>
      `;
    } else {
      head.innerHTML = `
        <tr>
          <th>Code</th><th>Date</th><th>Customer</th><th>Weight</th>
          <th>Service</th><th>Price</th><th>Payment</th><th>Status</th><th>Actions</th>
        </tr>
      `;
    }
  }

  // Render Rows
  const body = document.getElementById('txBody');
  const emptyState = document.getElementById('emptyState');
  if (!body) return;

  body.innerHTML = '';

  if (filtered.length === 0) {
    if (emptyState) {
      emptyState.style.display = 'block';
      emptyState.textContent = currentTab === 'voided'
        ? 'No voided records found.'
        : currentTab === 'released'
          ? 'No released orders found.'
          : 'No active orders right now. Add a new drop-off above.';
    }
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  for (const t of filtered) {
    const tr = document.createElement('tr');
    if (t.voided) tr.classList.add('is-voided');

    if (currentTab === 'voided') {
      tr.innerHTML = `
        <td class="no-strike"><span class="code-tag" title="Preview receipt">${t.code}</span></td>
        <td>${formatDate(t.createdAt)}</td>
        <td>
          <div class="customer-cell">
            <span class="customer-name">${escapeHtml(t.name)}</span>
            <span class="customer-phone">${t.phone ? escapeHtml(t.phone) : '—'}</span>
          </div>
        </td>
        <td>${t.weight} kg</td>
        <td><span class="badge type-${t.type}">${t.type === 'express' ? 'Express' : 'Regular'}</span></td>
        <td class="price-text">${formatPHP(t.price)}</td>
        <td class="no-strike"><span class="badge" style="background:#FEE2E2; color:#B91C1C;">${escapeHtml(t.voidReason || 'Voided')}</span></td>
        <td>${formatDateTime(t.voidedAt || t.updatedAt)}</td>
        <td class="no-strike">
          <button class="icon-btn print-btn" title="Print Receipt">🖨️</button>
        </td>
      `;
    } else {
      tr.innerHTML = `
        <td><span class="code-tag" title="Preview receipt">${t.code}</span></td>
        <td>${formatDate(t.createdAt)}</td>
        <td>
          <div class="customer-cell">
            <span class="customer-name">${escapeHtml(t.name)}</span>
            <span class="customer-phone">${t.phone ? escapeHtml(t.phone) : '—'}</span>
          </div>
        </td>
        <td>${t.weight} kg</td>
        <td><span class="badge type-${t.type}">${t.type === 'express' ? 'Express' : 'Regular'}</span></td>
        <td class="price-text">${formatPHP(t.price)}</td>
        <td class="paid-cell"></td>
        <td class="status-cell"></td>
        <td>
          <div class="table-actions">
            <button class="icon-btn print-btn" title="Print Receipt">🖨️</button>
            <button class="icon-btn del void-btn" title="Void Transaction">🚫</button>
          </div>
        </td>
      `;

      // Paid toggle button
      const paidCell = tr.querySelector('.paid-cell');
      const paidBtn = document.createElement('button');
      paidBtn.className = 'paid-toggle ' + (t.paid ? 'is-paid' : 'is-unpaid');
      paidBtn.innerHTML = t.paid ? '<span>Paid ✓</span>' : '<span>Unpaid</span>';
      paidBtn.addEventListener('click', async () => {
        const nextPaid = !t.paid;
        await appDb.updateTransaction(t.id || t.code, {
          paid: nextPaid,
          paidAt: nextPaid ? Date.now() : null
        });
        t.paid = nextPaid;
        t.paidAt = nextPaid ? Date.now() : null;
        showToast(`Order ${t.code} marked as ${nextPaid ? 'Paid' : 'Unpaid'}.`, 'info');
        renderTable(appState);
      });
      paidCell.appendChild(paidBtn);

      if (t.paid && t.paidAt) {
        const stamp = document.createElement('div');
        stamp.className = 'paid-date';
        stamp.textContent = formatDateTime(t.paidAt);
        paidCell.appendChild(stamp);
      }

      // Status selector
      const statusCell = tr.querySelector('.status-cell');
      const sel = document.createElement('select');
      sel.className = 'status-select status-' + (t.status || 'Received').toLowerCase();
      for (const s of STATUS_FLOW) {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        if (s === t.status) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', async (e) => {
        const newStatus = e.target.value;
        await appDb.updateTransaction(t.id || t.code, { status: newStatus });
        t.status = newStatus;

        // Re-bucket
        const all = await appDb.getTransactions();
        appState.allActive = all.filter(item => !item.voided && item.status !== 'Released');
        appState.allReleased = all.filter(item => !item.voided && item.status === 'Released');
        showToast(`Order ${t.code} updated to ${newStatus}.`, 'info');
        renderTable(appState);
      });
      statusCell.appendChild(sel);

      // Void action
      const voidBtn = tr.querySelector('.void-btn');
      if (voidBtn) {
        voidBtn.addEventListener('click', () => {
          showModal({
            title: `Void Order ${t.code}?`,
            message: `This will mark the order as voided. In compliance with BIR audit guidelines, the transaction record is kept in the Voided archive.`,
            confirmLabel: 'Void Transaction',
            confirmStyle: 'danger',
            requireReason: true,
            reasonOptions: VOID_REASONS,
            onConfirm: async (reason) => {
              await appDb.voidTransaction(t.id || t.code, reason);
              showToast(`Order ${t.code} has been voided.`, 'info');

              const all = await appDb.getTransactions();
              appState.allActive = all.filter(item => !item.voided && item.status !== 'Released');
              appState.allReleased = all.filter(item => !item.voided && item.status === 'Released');
              appState.allVoided = await appDb.getVoidedTransactions();
              renderTable(appState);
            }
          });
        });
      }
    }

    // Print receipt action
    const printBtn = tr.querySelector('.print-btn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        printReceipt(t, appState.settings);
      });
    }

    // Clicking code tag opens print preview too
    const codeTag = tr.querySelector('.code-tag');
    if (codeTag) {
      codeTag.addEventListener('click', () => {
        printReceipt(t, appState.settings);
      });
    }

    body.appendChild(tr);
  }
}
