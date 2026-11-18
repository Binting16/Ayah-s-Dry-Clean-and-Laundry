import { DEFAULT_SETTINGS } from './config.js';

/**
 * Global reactive state container (v2.2)
 */
export const state = {
  currentView: 'log',       // 'log' | 'bir'
  selectedYear: new Date().getFullYear(),
  transactions: [],         // Visible filtered transactions for the active tab/view
  allActive: [],            // Non-deleted, non-released orders
  allReleased: [],          // Non-deleted, released orders
  allDeleted: [],           // Deleted / voided orders (visible in BIR tab)
  cashflow: [],             // Petty cash / delivery expenses
  settings: { ...DEFAULT_SETTINGS },
  currentTab: 'active',     // 'active' | 'released' (within Laundry Log view)
  birFilter: 'all',         // 'all' | 'completed' | 'deleted' (within BIR view)
  searchQuery: '',
  dateFilter: {
    from: null,
    to: null
  },
  dbMode: 'loading',        // 'google-sheets' | 'localStorage' | 'loading'
  recap: null,              // { daily, monthly, annual }

  listeners: new Set(),

  /**
   * Subscribe to state updates
   * @param {Function} fn
   */
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },

  /**
   * Notify all listeners of changes
   */
  notify() {
    for (const fn of this.listeners) {
      try {
        fn(this);
      } catch (err) {
        console.error('Error in state subscriber:', err);
      }
    }
  }
};
