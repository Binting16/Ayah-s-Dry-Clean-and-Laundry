import { db } from './db.js';
import { state } from './state.js';
import { initHeader } from './ui/header.js';
import { renderStats } from './ui/stats.js';
import { initForm } from './ui/form.js';
import { initTable, renderTable } from './ui/table.js';
import { initReports, renderReportsMetrics } from './ui/reports.js';
import { initSettings } from './ui/settings.js';
import { showToast } from './ui/toast.js';
import { showModal } from './ui/modal.js';

async function refreshAllData() {
  const all = await db.getTransactions();
  state.allActive = all.filter(t => !t.voided && t.status !== 'Released');
  state.allReleased = all.filter(t => !t.voided && t.status === 'Released');
  state.allVoided = await db.getVoidedTransactions();
}

async function boot() {
  // 1. Initialize database connection (Firestore or localStorage)
  const mode = await db.init();
  state.dbMode = mode;

  // 2. Fetch current settings
  state.settings = await db.getSettings();

  // 3. Check for legacy data from window.storage or legacy storage
  try {
    const migration = await db.checkLegacyMigration();
    const existingTx = await db.getTransactions();

    if (migration.found && existingTx.length === 0) {
      showModal({
        title: 'Import Existing Laundry Log Data?',
        message: `Found ${migration.count} previous transactions from your earlier session. Would you like to import them into the new database?`,
        confirmLabel: 'Import Records',
        cancelLabel: 'Start Fresh',
        confirmStyle: 'primary',
        onConfirm: async () => {
          showToast('Importing records...', 'info');
          const count = await migration.importFn();
          await refreshAllData();
          state.notify();
          showToast(`Successfully imported ${count} transactions!`, 'success');
        }
      });
    }
  } catch (mErr) {
    console.warn('Migration check error:', mErr);
  }

  // 4. Fetch initial transactions
  await refreshAllData();

  // 5. Initialize UI Modules
  initHeader(state);
  renderStats(state);
  initForm(state, db);
  initTable(state, db);
  initReports(state, db);
  initSettings(state, db);

  // 6. Subscribe to state changes for stats and reports re-rendering
  state.subscribe((s) => {
    renderStats(s);
    renderReportsMetrics();
  });

  // 7. Hide loading banner
  const loadingBanner = document.getElementById('loadingBanner');
  if (loadingBanner) {
    loadingBanner.style.display = 'none';
  }
}

// Bootstrap on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    boot().catch(err => {
      console.error('Boot error:', err);
      showToast('Error initializing application. Please refresh.', 'error');
    });
  });
} else {
  boot().catch(err => {
    console.error('Boot error:', err);
    showToast('Error initializing application. Please refresh.', 'error');
  });
}
