import { DEFAULT_SETTINGS } from './config.js';

/**
 * Global reactive state container
 */
export const state = {
  transactions: [],     // Visible filtered transactions for the active tab
  allActive: [],        // All active orders (non-released, non-voided)
  allReleased: [],      // All completed orders (released, non-voided)
  allVoided: [],        // All soft-deleted/voided orders
  settings: { ...DEFAULT_SETTINGS },
  currentTab: 'active', // 'active' | 'released' | 'voided'
  searchQuery: '',
  dateFilter: {
    from: null,
    to: null
  },
  dbMode: 'loading',    // 'firestore' | 'localStorage' | 'loading'

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
