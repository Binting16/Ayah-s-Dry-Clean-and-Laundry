let appState = null;

/**
 * Initialize top-level navigation: Laundry Log vs BIR & Financial Records
 * @param {Object} state
 * @param {Function} [onViewChange]
 */
export function initNav(state, onViewChange) {
  appState = state;

  const tabLog = document.getElementById('navTabLog');
  const tabBir = document.getElementById('navTabBir');
  const viewLog = document.getElementById('viewLaundryLog');
  const viewBir = document.getElementById('viewBirRecords');
  const footer = document.getElementById('stickyFooter');

  function setView(view) {
    appState.currentView = view;

    if (view === 'bir') {
      tabLog?.classList.remove('is-active');
      tabBir?.classList.add('is-active');
      if (viewLog) viewLog.style.display = 'none';
      if (viewBir) viewBir.style.display = 'block';
      if (footer) footer.style.display = 'none'; // Only show in counter view
    } else {
      tabBir?.classList.remove('is-active');
      tabLog?.classList.add('is-active');
      if (viewBir) viewBir.style.display = 'none';
      if (viewLog) viewLog.style.display = 'block';
      if (footer) footer.style.display = 'flex';
    }

    if (typeof onViewChange === 'function') {
      onViewChange(view);
    }
  }

  tabLog?.addEventListener('click', () => setView('log'));
  tabBir?.addEventListener('click', () => setView('bir'));

  // Initial state
  setView(appState.currentView || 'log');
}
