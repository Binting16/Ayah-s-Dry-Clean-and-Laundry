import { STATUS_FLOW, DELETE_REASONS } from '../config.js';
import { formatDateTime, parseDate } from '../utils/dates.js';
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
        <h2>Active & Released Orders</h2>
        <p class="table-subtitle" id="tableSubtitle">Track every drop-off from intake to customer pickup.</p>
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

  // Create Tabs container for Laundry Log view
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
    <button class="tab is-active" data-tab="active">Active Orders <span class="tab-count" id="countActive">0</span></button>
    <button class="tab" data-tab="released">Released Orders <span class="tab-count" id="countReleased">0</span></button>
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

  const sourceList = currentTab === 'released'
    ? (state.allReleased || [])
    : (state.allActive || []);

  const nonDeleted = sourceList.filter(t => String(t.recordStatus).toUpperCase() !== 'DELETED');

  const filtered = nonDeleted.filter(t => {
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

  // Update counters
  const countActiveEl = document.getElementById('countActive');
  const countReleasedEl = document.getElementById('countReleased');
  if (countActiveEl) countActiveEl.textContent = (state.allActive || []).filter(t => String(t.recordStatus).toUpperCase() !== 'DELETED').length;
  if (countReleasedEl) countReleasedEl.textContent = (state.allReleased || []).filter(t => String(t.recordStatus).toUpperCase() !== 'DELETED').length;

  document.querySelectorAll('#tableTabs .tab').forEach(b => {
    b.classList.toggle('is-active', b.dataset.tab === currentTab);
  });

  const head = document.getElementById('txHead');
  if (head) {
    head.innerHTML = `
      <tr>
        <th>Code</th><th>Date & Time</th><th>Customer</th><th>Weight</th>
        <th>Service</th><th>Price</th><th>Payment</th><th>Status</th><th>Actions</th>
      </tr>
    `;
  }

  const body = document.getElementById('txBody');
  const emptyState = document.getElementById('emptyState');
  if (!body) return;

  body.innerHTML = '';

  if (filtered.length === 0) {
    if (emptyState) {
      emptyState.style.display = 'block';
      emptyState.textContent = currentTab === 'released'
        ? 'No released orders found.'
        : 'No active orders right now. Add a new drop-off above.';
    }
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  for (const t of filtered) {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td><span class="code-tag" title="Print/Preview receipt">${t.code}</span></td>
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
      <td class="paid-cell"></td>
      <td class="status-cell"></td>
      <td>
        <div class="table-actions">
          <button class="icon-btn print-btn" title="Print Receipt">🖨️</button>
          <button class="icon-btn del delete-btn" title="Delete from Workspace">🗑️</button>
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
      const now = Date.now();
      await appDb.updateTransaction(t.code, {
        paid: nextPaid,
        paidAt: nextPaid ? now : null
      });

      t.paid = nextPaid;
      t.paidAt = nextPaid ? now : null;

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
      await appDb.updateTransaction(t.code, { status: newStatus });
      t.status = newStatus;

      if (newStatus === 'Released') {
        appState.allActive = appState.allActive.filter(item => item.code !== t.code);
        if (!appState.allReleased.some(item => item.code === t.code)) {
          appState.allReleased.unshift(t);
        }
      } else {
        appState.allReleased = appState.allReleased.filter(item => item.code !== t.code);
        if (!appState.allActive.some(item => item.code === t.code)) {
          appState.allActive.unshift(t);
        }
      }

      showToast(`Order ${t.code} updated to ${newStatus}.`, 'info');
      renderTable(appState);
    });
    statusCell.appendChild(sel);

    // Delete action
    const deleteBtn = tr.querySelector('.delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        showModal({
          title: `Delete Order ${t.code}?`,
          message: `This will remove the transaction from your active Laundry Log. An audit copy remains saved in Google Sheets and the BIR Records view.`,
          confirmLabel: 'Delete Order',
          confirmStyle: 'danger',
          requireReason: true,
          reasonOptions: DELETE_REASONS,
          onConfirm: async (reason) => {
            await appDb.deleteTransaction(t.code, reason);
            t.recordStatus = 'DELETED';
            t.deleteReason = reason;

            appState.allActive = appState.allActive.filter(item => item.code !== t.code);
            appState.allReleased = appState.allReleased.filter(item => item.code !== t.code);
            appState.allDeleted.unshift(t);

            showToast(`Order ${t.code} removed from workspace.`, 'info');
            renderTable(appState);
          }
        });
      });
    }

    // Print Receipt
    const printBtn = tr.querySelector('.print-btn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        printReceipt(t, appState.settings);
      });
    }

    const codeTag = tr.querySelector('.code-tag');
    if (codeTag) {
      codeTag.addEventListener('click', () => {
        printReceipt(t, appState.settings);
      });
    }

    body.appendChild(tr);
  }
}
