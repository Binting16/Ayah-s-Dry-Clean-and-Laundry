import { showToast } from './toast.js';
import { escapeHtml } from '../utils/sanitize.js';

let appState = null;
let appDb = null;
let saveDebounceTimer = null;

export function initSettings(state, db) {
  appState = state;
  appDb = db;

  // Apply print mode class to body
  updateBodyPrintClass(state.settings.printMode || 'a4');
}

function updateBodyPrintClass(mode) {
  document.body.classList.remove('print-mode-a4', 'print-mode-thermal-80', 'print-mode-thermal-58');
  document.body.classList.add(`print-mode-${mode || 'a4'}`);
}

export function openSettings(state) {
  const sidebar = document.getElementById('settingsSidebar');
  if (!sidebar) return;

  const s = state.settings || {};

  sidebar.innerHTML = `
    <div class="settings-header">
      <h2>Shop Settings</h2>
      <button class="icon-btn" id="closeSettingsBtn" title="Close Settings">✕</button>
    </div>

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
        <span class="help-text">Adjust minimum requirement as operating costs change.</span>
      </div>
    </div>

    <div class="settings-group">
      <h3>Business & Receipt Info (BIR)</h3>
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
    </div>

    <div class="settings-group">
      <h3>Printing Preferences</h3>
      <div class="settings-field">
        <label for="setPrintMode">Printer Format</label>
        <select id="setPrintMode">
          <option value="a4" ${s.printMode === 'a4' ? 'selected' : ''}>Standard A4 / Letter Paper</option>
          <option value="thermal-80" ${s.printMode === 'thermal-80' ? 'selected' : ''}>Thermal POS (80mm width)</option>
          <option value="thermal-58" ${s.printMode === 'thermal-58' ? 'selected' : ''}>Thermal POS (58mm width)</option>
        </select>
        <span class="help-text">Choose between standard office paper or roll receipt printer.</span>
      </div>
    </div>
  `;

  sidebar.style.display = 'flex';

  const closeBtn = sidebar.querySelector('#closeSettingsBtn');
  closeBtn.addEventListener('click', () => {
    sidebar.style.display = 'none';
  });

  // Attach change listeners to all fields
  const inputs = sidebar.querySelectorAll('input, select');
  inputs.forEach(inp => {
    inp.addEventListener('input', scheduleSave);
    inp.addEventListener('change', scheduleSave);
  });
}

function scheduleSave() {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(async () => {
    const reg = parseFloat(document.getElementById('setRateReg')?.value) || 20;
    const exp = parseFloat(document.getElementById('setRateExp')?.value) || 35;
    const minW = parseFloat(document.getElementById('setMinWeight')?.value) || 5;
    const bName = document.getElementById('setBizName')?.value || '';
    const bAddr = document.getElementById('setBizAddress')?.value || '';
    const bTIN = document.getElementById('setBizTIN')?.value || '';
    const bPhone = document.getElementById('setBizPhone')?.value || '';
    const pMode = document.getElementById('setPrintMode')?.value || 'a4';

    const updates = {
      rateRegular: reg,
      rateExpress: exp,
      minWeight: minW,
      businessName: bName,
      businessAddress: bAddr,
      businessTIN: bTIN,
      businessPhone: bPhone,
      printMode: pMode
    };

    appState.settings = { ...appState.settings, ...updates };
    updateBodyPrintClass(pMode);

    // Update weight input minimum in form
    const fWeight = document.getElementById('fWeight');
    if (fWeight) {
      fWeight.min = minW;
      fWeight.placeholder = minW;
    }

    await appDb.updateSettings(updates);
    showToast('Settings saved.', 'info', 2000);
  }, 400);
}
