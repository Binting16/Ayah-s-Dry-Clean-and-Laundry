import { db } from './db.js';
import { state } from './state.js';
import { initHeader } from './ui/header.js';
import { initNav } from './ui/nav.js';
import { initForm } from './ui/form.js';
import { initTable, renderTable } from './ui/table.js';
import { renderFooter } from './ui/footer.js';
import { initBir, loadBirData } from './ui/bir.js';
import { initSettings } from './ui/settings.js';
import { showToast } from './ui/toast.js';
import { showModal } from './ui/modal.js';

async function refreshAllData() {
  const currentYear = state.selectedYear || new Date().getFullYear();
  const all = await db.getTransactions(currentYear, true);

  state.allActive = all.filter(t => String(t.recordStatus).toUpperCase() !== 'DELETED' && t.status !== 'Released');
  state.allReleased = all.filter(t => String(t.recordStatus).toUpperCase() !== 'DELETED' && t.status === 'Released');
  state.allDeleted = all.filter(t => String(t.recordStatus).toUpperCase() === 'DELETED');
}

async function boot() {
  // 1. Initialize database connection (Google Sheets Web App or localStorage)
  const mode = await db.init();
  state.dbMode = mode;

  // 2. Load shop settings
  state.settings = await db.getSettings();

  // 3. Check for legacy data migration from window.storage or old localStorage
  try {
    const migration = await db.checkLegacyMigration();
    const existingTx = await db.getTransactions(state.selectedYear, true);

    if (migration.found && existingTx.length === 0) {
      showModal({
        title: 'Import Previous Laundry Records?',
        message: `Found ${migration.count} previous transactions from your earlier session. Would you like to import them now?`,
        confirmLabel: 'Import Records',
        cancelLabel: 'Start Fresh',
        confirmStyle: 'primary',
        onConfirm: async () => {
          showToast('Importing records...', 'info');
          const count = await migration.importFn();
          await refreshAllData();
          state.notify();
          renderFooter(state);
          showToast(`Successfully imported ${count} transactions!`, 'success');
        }
      });
    }
  } catch (mErr) {
    console.warn('Migration check error:', mErr);
  }

  // 4. Fetch initial transactions for current year
  await refreshAllData();

  // 5. Initialize UI Modules
  initHeader(state);

  initNav(state, (view) => {
    if (view === 'bir') {
      loadBirData();
    } else {
      renderTable(state);
      renderFooter(state);
    }
  });

  initForm(state, db);
  initTable(state, db);
  initBir(state, db);
  initSettings(state, db);
  renderFooter(state);

  // 6. State change subscriptions
  state.subscribe((s) => {
    if (s.currentView === 'log') {
      renderTable(s);
      renderFooter(s);
    } else if (s.currentView === 'bir') {
      loadBirData();
    }
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
