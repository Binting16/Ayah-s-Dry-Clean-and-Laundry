import { showToast } from './toast.js';
import { showModal } from './modal.js';
import { escapeHtml } from '../utils/sanitize.js';
import { formatPHP } from '../utils/currency.js';
import { formatISO, formatDateTime } from '../utils/dates.js';
import { openBirView } from './bir.js';
import { CASHFLOW_CATEGORIES } from '../config.js';

let appState = null;
let appDb = null;
let saveDebounceTimer = null;

export function initSettings(state, db) {
  appState = state;
  appDb = db;

  updateBodyPrintClass(state.settings.printMode || 'a4');
}

function updateBodyPrintClass(mode) {
  document.body.classList.remove('print-mode-a4', 'print-mode-thermal-80', 'print-mode-thermal-58');
  document.body.classList.add(`print-mode-${mode || 'a4'}`);
}

export async function openSettings(state) {
  const sidebar = document.getElementById('settingsSidebar');
  if (!sidebar) return;

  const s = state.settings || {};
  const todayStr = formatISO(new Date());

  // 1. Calculate private daily collections
  const allOrders = [...(state.allActive || []), ...(state.allReleased || [])];
  const paidToday = allOrders.filter(t => {
    if (!t.paid) return false;
    if (String(t.recordStatus).toUpperCase() === 'DELETED') return false;
    const pDate = t.paidAt ? formatISO(t.paidAt) : null;
    const cDate = t.date || (t.createdAt ? formatISO(t.createdAt) : null);
    return pDate === todayStr || cDate === todayStr;
  });
  const collectedToday = paidToday.reduce((sum, t) => sum + (Number(t.price) || 0), 0);

  // 2. Calculate today's cashflow expenses
  const cashflows = await appDb.getCashflow(50);
  const todayCashflows = cashflows.filter(c => c.date === todayStr);
  const expensesToday = todayCashflows
    .filter(c => c.type === 'OUT')
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const cashInToday = todayCashflows
    .filter(c => c.type === 'IN')
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const netDrawerToday = collectedToday + cashInToday - expensesToday;

  sidebar.innerHTML = `
    <div class="settings-header">
      <h2>Manager & Settings</h2>
      <button class="icon-btn" id="closeSettingsBtn" title="Close Settings">✕</button>
    </div>

    <!-- Private Daily Shift & Cash Drawer Summary -->
    <div class="settings-group" style="background:var(--surface-subtle); padding:14px; border-radius:var(--radius-md); border:1px solid var(--border);">
      <h3 style="margin-top:0; color:var(--primary-dark);">💰 Daily Shift & Cash Drawer (Private)</h3>
      <div style="display:flex; justify-content:space-between; margin:8px 0; font-size:0.9rem;">
        <span>Laundry Collected Today:</span>
        <strong style="color:var(--success-dark);">${formatPHP(collectedToday)} (${paidToday.length} orders)</strong>
      </div>
      <div style="display:flex; justify-content:space-between; margin:8px 0; font-size:0.9rem;">
        <span>Petty Cash / Delivery Out:</span>
        <strong style="color:var(--danger);">${formatPHP(expensesToday)}</strong>
      </div>
      <hr style="border:none; border-top:1px dashed var(--border); margin:10px 0;">
      <div style="display:flex; justify-content:space-between; font-size:1rem;">
        <span><strong>Net Drawer Cash:</strong></span>
        <strong style="color:var(--primary-dark); font-family:var(--font-display); font-size:1.25rem;">${formatPHP(netDrawerToday)}</strong>
      </div>
    </div>

    <!-- Cash In & Out / Petty Cash Logger -->
    <div class="settings-group">
      <h3>🛵 Petty Cash, Parcels & Expenses</h3>
      <p style="font-size:0.78rem; color:var(--ink-secondary); margin:0 0 10px;">
        Record parcel rider fees, delivery payments, gas refills, or supplies.
      </p>

      <form id="cashflowQuickForm" style="display:flex; flex-direction:column; gap:8px;">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
          <select id="cfType" style="padding:8px; border:1px solid var(--border); border-radius:var(--radius-sm); font-size:0.85rem; background:#fff;">
            <option value="OUT">Cash OUT (Expense / Delivery)</option>
            <option value="IN">Cash IN (Top-up)</option>
          </select>
          <input type="number" id="cfAmount" placeholder="Amount (₱)" min="1" step="1" required style="padding:8px; border:1px solid var(--border); border-radius:var(--radius-sm); font-size:0.85rem;">
        </div>

        <select id="cfCategory" style="padding:8px; border:1px solid var(--border); border-radius:var(--radius-sm); font-size:0.85rem; background:#fff;">
          ${CASHFLOW_CATEGORIES.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
        </select>

        <input type="text" id="cfNotes" placeholder="Notes (e.g. Shopee parcel, Rider tip, Gas)" style="padding:8px; border:1px solid var(--border); border-radius:var(--radius-sm); font-size:0.85rem;">

        <button type="submit" class="btn-secondary" style="min-height:36px; padding:6px 12px; font-size:0.85rem;">
          + Log Cash Movement
        </button>
      </form>

      <div id="cashflowRecentList" style="margin-top:10px; max-height:140px; overflow-y:auto; font-size:0.8rem; border:1px solid var(--border); border-radius:var(--radius-sm); padding:6px;">
        ${cashflows.slice(0, 5).map(c => `
          <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--border);">
            <span>${escapeHtml(c.category)}: ${escapeHtml(c.notes || '—')}</span>
            <strong style="color:${c.type === 'IN' ? 'var(--success-dark)' : 'var(--danger)'}">
              ${c.type === 'IN' ? '+' : '-'}${formatPHP(c.amount)}
            </strong>
          </div>
        `).join('') || '<div style="color:var(--ink-secondary); text-align:center; padding:6px;">No recent cash movements.</div>'}
      </div>
    </div>

    <!-- Owner / Accounting Records Link -->
    <div class="settings-group">
      <h3>Tax & Accounting Records</h3>
      <button class="btn-primary" id="btnOpenBirFromSettings" style="width:100%; min-height:44px;">
        📋 Open BIR & Financial Records
      </button>
      <span class="help-text">Access annual business reports, master ledgers, and official CSV exports away from customer view.</span>
    </div>

    <!-- GCash / Maya Settings for Receipts -->
    <div class="settings-group">
      <h3>Digital Payments on Receipts (GCash / Maya)</h3>
      <div class="settings-field">
        <label for="setGcashNum">GCash Mobile Number</label>
        <input type="text" id="setGcashNum" placeholder="e.g. 0917 123 4567" value="${escapeHtml(s.gcashNumber || '')}">
      </div>
      <div class="settings-field">
        <label for="setGcashName">GCash Account Name</label>
        <input type="text" id="setGcashName" placeholder="e.g. Ayah L." value="${escapeHtml(s.gcashName || '')}">
      </div>
      <div class="settings-field">
        <label for="setMayaNum">Maya Mobile Number (Optional)</label>
        <input type="text" id="setMayaNum" placeholder="e.g. 0918 765 4321" value="${escapeHtml(s.mayaNumber || '')}">
      </div>
    </div>

    <!-- Pricing & Operational Defaults -->
    <div class="settings-group">
      <h3>Pricing & Minimums</h3>
      <div class="settings-field">
        <label for="setRateReg">Regular Rate (₱/kg)</label>
        <input type="number" id="setRateReg" min="0" step="1" value="${s.rateRegular || 20}">
      </div>

      <div class="settings-field">
        <label for="setRateExp">Express Rate (₱/kg)</label>
        <input type="number" id="setRateExp" min="0" step="1" value="${s.rateExpress || 35}">
      </div>

      <div class="settings-field">
        <label for="setMinWeight">Minimum Weight (kg)</label>
        <input type="number" id="setMinWeight" min="0.5" step="0.5" value="${s.minWeight || 5}">
      </div>
    </div>

    <!-- Business Details -->
    <div class="settings-group">
      <h3>Business Details (Printed on Receipts)</h3>
      <div class="settings-field">
        <label for="setBizName">Business Name</label>
        <input type="text" id="setBizName" value="${escapeHtml(s.businessName || "Ayah's Dry Clean and Laundry")}">
      </div>
      <div class="settings-field">
        <label for="setBizAddress">Business Address</label>
        <input type="text" id="setBizAddress" value="${escapeHtml(s.businessAddress || 'Your Address Here')}">
      </div>
      <div class="settings-field">
        <label for="setBizTIN">TIN Number</label>
        <input type="text" id="setBizTIN" value="${escapeHtml(s.businessTIN || '000-000-000-000')}">
      </div>
      <div class="settings-field">
        <label for="setBizPhone">Contact Phone</label>
        <input type="text" id="setBizPhone" value="${escapeHtml(s.businessPhone || '0900 000 0000')}">
      </div>
      <div class="settings-field">
        <label for="setPrintMode">Printer Format</label>
        <select id="setPrintMode">
          <option value="a4" ${s.printMode === 'a4' ? 'selected' : ''}>Standard A4 / Letter Paper</option>
          <option value="thermal-80" ${s.printMode === 'thermal-80' ? 'selected' : ''}>Thermal POS (80mm width)</option>
          <option value="thermal-58" ${s.printMode === 'thermal-58' ? 'selected' : ''}>Thermal POS (58mm width)</option>
        </select>
      </div>
    </div>

    <!-- Google Sheets Database -->
    <div class="settings-group">
      <h3>Google Sheets Database API</h3>
      <div class="settings-field">
        <label for="setSheetsUrl">Apps Script Web App URL</label>
        <input type="url" id="setSheetsUrl" placeholder="https://script.google.com/macros/s/.../exec" value="${escapeHtml(s.googleSheetsUrl || '')}">
      </div>
    </div>

    <!-- Testing & Maintenance -->
    <div class="settings-group" style="border-top:1px dashed var(--border); padding-top:14px;">
      <h3>System Maintenance & Testing Tools</h3>
      <div class="settings-field">
        <label for="setCounterVal">Current Code Counter</label>
        <div style="display:flex; gap:8px;">
          <input type="number" id="setCounterVal" min="0" value="${s.counter || 0}" style="flex:1;">
          <button class="btn-secondary" id="btnResetCounter" style="min-height:40px; padding:4px 12px; font-size:0.85rem;">Reset to 0</button>
        </div>
        <span class="help-text">Next order code will use this number + 1.</span>
      </div>

      <button class="btn-danger" id="btnClearTestData" style="width:100%; margin-top:10px;">
        ⚠️ Clear All Test Records
      </button>
      <span class="help-text">Erases all test transactions for ${s.counterYear || new Date().getFullYear()} and resets code counter.</span>
    </div>
  `;

  sidebar.style.display = 'flex';

  // Wire Close Button
  sidebar.querySelector('#closeSettingsBtn')?.addEventListener('click', () => {
    sidebar.style.display = 'none';
  });

  // Wire Open BIR Button
  sidebar.querySelector('#btnOpenBirFromSettings')?.addEventListener('click', () => {
    sidebar.style.display = 'none';
    openBirView();
  });

  // Wire Cashflow Quick Form
  const cfForm = sidebar.querySelector('#cashflowQuickForm');
  cfForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('cfType').value;
    const amount = parseFloat(document.getElementById('cfAmount').value) || 0;
    const category = document.getElementById('cfCategory').value;
    const notes = document.getElementById('cfNotes').value.trim();

    if (amount <= 0) return;

    await appDb.addCashflow({ type, amount, category, notes });
    showToast(`Logged ${type === 'IN' ? 'Cash IN' : 'Expense'}: ${formatPHP(amount)}`, 'success');
    openSettings(appState); // refresh drawer
  });

  // Wire Reset Counter Button
  sidebar.querySelector('#btnResetCounter')?.addEventListener('click', async () => {
    await appDb.updateSettings({ counter: 0 });
    document.getElementById('setCounterVal').value = 0;
    appState.settings.counter = 0;
    showToast('Code counter reset to 0.', 'info');
  });

  // Wire Clear Test Data Button
  sidebar.querySelector('#btnClearTestData')?.addEventListener('click', () => {
    const yr = appState.settings.counterYear || new Date().getFullYear();
    showModal({
      title: `Clear All Test Data for ${yr}?`,
      message: `This will erase all transactions for ${yr} from Google Sheets and local storage, and reset the counter back to 0. Are you sure?`,
      confirmLabel: 'Clear All Data',
      confirmStyle: 'danger',
      onConfirm: async () => {
        await appDb.clearTestData(yr);
        appState.allActive = [];
        appState.allReleased = [];
        appState.allDeleted = [];
        appState.settings.counter = 0;
        appState.notify();
        showToast('All test records cleared. Slate is clean!', 'success');
        openSettings(appState);
      }
    });
  });

  // Attach change listeners to standard inputs
  const inputs = sidebar.querySelectorAll('input:not(#cfAmount):not(#cfNotes), select:not(#cfType):not(#cfCategory)');
  inputs.forEach(inp => {
    inp.addEventListener('input', scheduleSave);
    inp.addEventListener('change', scheduleSave);
  });
}

function scheduleSave() {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(async () => {
    const sheetsUrl = document.getElementById('setSheetsUrl')?.value?.trim() || '';
    const reg = parseFloat(document.getElementById('setRateReg')?.value) || 20;
    const exp = parseFloat(document.getElementById('setRateExp')?.value) || 35;
    const minW = parseFloat(document.getElementById('setMinWeight')?.value) || 5;
    const bName = document.getElementById('setBizName')?.value || '';
    const bAddr = document.getElementById('setBizAddress')?.value || '';
    const bTIN = document.getElementById('setBizTIN')?.value || '';
    const bPhone = document.getElementById('setBizPhone')?.value || '';
    const gNum = document.getElementById('setGcashNum')?.value || '';
    const gName = document.getElementById('setGcashName')?.value || '';
    const mNum = document.getElementById('setMayaNum')?.value || '';
    const mName = document.getElementById('setMayaName')?.value || '';
    const pMode = document.getElementById('setPrintMode')?.value || 'a4';
    const counterVal = parseInt(document.getElementById('setCounterVal')?.value, 10) || 0;

    const updates = {
      googleSheetsUrl: sheetsUrl,
      rateRegular: reg,
      rateExpress: exp,
      minWeight: minW,
      businessName: bName,
      businessAddress: bAddr,
      businessTIN: bTIN,
      businessPhone: bPhone,
      gcashNumber: gNum,
      gcashName: gName,
      mayaNumber: mNum,
      mayaName: mName,
      printMode: pMode,
      counter: counterVal
    };

    appState.settings = { ...appState.settings, ...updates };
    updateBodyPrintClass(pMode);

    const fWeight = document.getElementById('fWeight');
    if (fWeight) {
      fWeight.min = minW;
      fWeight.placeholder = minW;
    }

    await appDb.updateSettings(updates);
    showToast('Settings saved.', 'info', 2000);
  }, 400);
}
