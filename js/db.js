import { FIREBASE_CONFIG, DEFAULT_SETTINGS, STORAGE_PREFIX } from './config.js';
import { generateCode } from './utils/codes.js';
import { parseDate } from './utils/dates.js';

let mode = 'localStorage';
let firestoreInstance = null;

// LocalStorage Helper Keys
const KEY_TX = `${STORAGE_PREFIX}:transactions`;
const KEY_SETTINGS = `${STORAGE_PREFIX}:settings`;
const KEY_CUSTOMERS = `${STORAGE_PREFIX}:customers`;

function getLocal(key, defaultVal) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch (e) {
    console.error(`Error reading ${key} from localStorage`, e);
    return defaultVal;
  }
}

function setLocal(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error(`Error writing ${key} to localStorage`, e);
  }
}

export const db = {
  /**
   * Initializes database connection. Falls back to localStorage if Firebase is unconfigured or unavailable.
   * @returns {Promise<'firestore'|'localStorage'>}
   */
  async init() {
    const isConfigured = FIREBASE_CONFIG &&
      FIREBASE_CONFIG.apiKey &&
      FIREBASE_CONFIG.apiKey !== 'REPLACE_ME' &&
      FIREBASE_CONFIG.projectId !== 'REPLACE_ME';

    if (isConfigured && typeof window.firebase !== 'undefined') {
      try {
        if (!window.firebase.apps.length) {
          window.firebase.initializeApp(FIREBASE_CONFIG);
        }
        firestoreInstance = window.firebase.firestore();

        // Enable offline persistence
        try {
          await firestoreInstance.enablePersistence({ synchronizeTabs: true });
        } catch (persErr) {
          if (persErr.code === 'failed-precondition') {
            console.warn('Firestore persistence failed: multiple tabs open');
          } else if (persErr.code === 'unimplemented') {
            console.warn('Firestore persistence not supported in this browser');
          }
        }

        mode = 'firestore';
        return 'firestore';
      } catch (err) {
        console.warn('Firebase init failed, falling back to localStorage:', err);
        mode = 'localStorage';
        return 'localStorage';
      }
    }

    mode = 'localStorage';
    return 'localStorage';
  },

  getMode() {
    return mode;
  },

  /**
   * Fetch current shop settings
   * @returns {Promise<Object>}
   */
  async getSettings() {
    if (mode === 'firestore' && firestoreInstance) {
      try {
        const docRef = firestoreInstance.collection('settings').doc('shop');
        const snap = await docRef.get();
        if (snap.exists) {
          return { ...DEFAULT_SETTINGS, ...snap.data() };
        }
        // Initialize doc if missing
        await docRef.set(DEFAULT_SETTINGS);
        return { ...DEFAULT_SETTINGS };
      } catch (e) {
        console.warn('Firestore getSettings failed, using local fallback:', e);
      }
    }

    const localSettings = getLocal(KEY_SETTINGS, null);
    if (!localSettings) {
      setLocal(KEY_SETTINGS, DEFAULT_SETTINGS);
      return { ...DEFAULT_SETTINGS };
    }
    return { ...DEFAULT_SETTINGS, ...localSettings };
  },

  /**
   * Update shop settings
   * @param {Object} updates
   */
  async updateSettings(updates) {
    if (mode === 'firestore' && firestoreInstance) {
      try {
        const docRef = firestoreInstance.collection('settings').doc('shop');
        await docRef.set(updates, { merge: true });
      } catch (e) {
        console.warn('Firestore updateSettings failed, saving locally:', e);
      }
    }

    const current = await this.getSettings();
    const updated = { ...current, ...updates };
    setLocal(KEY_SETTINGS, updated);
  },

  /**
   * Add a new drop-off transaction
   * @param {Object} tx
   * @returns {Promise<Object>}
   */
  async addTransaction(tx) {
    const settings = await this.getSettings();
    const nextCounter = (settings.counter || 0) + 1;
    const code = generateCode(nextCounter);
    const now = Date.now();

    const newRecord = {
      code,
      name: (tx.name || '').trim(),
      phone: (tx.phone || '').trim(),
      weight: parseFloat(tx.weight) || 0,
      type: tx.type === 'express' ? 'express' : 'regular',
      price: Math.round(Number(tx.price)) || 0,
      paid: Boolean(tx.paid),
      paidAt: tx.paid ? (tx.paidAt || now) : null,
      status: tx.status || 'Received',
      createdAt: tx.createdAt || now,
      updatedAt: now,
      voided: false,
      voidedAt: null,
      voidReason: null,
      notes: tx.notes || ''
    };

    // Update counter in settings
    await this.updateSettings({ counter: nextCounter });

    // Upsert customer info
    await this.upsertCustomer(newRecord.name, newRecord.phone);

    if (mode === 'firestore' && firestoreInstance) {
      try {
        const docRef = await firestoreInstance.collection('transactions').add(newRecord);
        return { id: docRef.id, ...newRecord };
      } catch (e) {
        console.warn('Firestore addTransaction failed, writing to local storage:', e);
      }
    }

    // LocalStorage fallback
    const id = 'local_' + now + '_' + Math.random().toString(36).substr(2, 6);
    const stored = { id, ...newRecord };
    const list = getLocal(KEY_TX, []);
    list.unshift(stored);
    setLocal(KEY_TX, list);
    return stored;
  },

  /**
   * Update an existing transaction
   * @param {string} id
   * @param {Object} updates
   */
  async updateTransaction(id, updates) {
    const now = Date.now();
    const safeUpdates = { ...updates, updatedAt: now };

    if (mode === 'firestore' && firestoreInstance && !id.startsWith('local_')) {
      try {
        await firestoreInstance.collection('transactions').doc(id).update(safeUpdates);
        return;
      } catch (e) {
        console.warn('Firestore updateTransaction failed:', e);
      }
    }

    const list = getLocal(KEY_TX, []);
    const idx = list.findIndex(t => t.id === id || t.code === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...safeUpdates };
      setLocal(KEY_TX, list);
    }
  },

  /**
   * Soft-delete (void) a transaction with audit reason
   * @param {string} id
   * @param {string} reason
   */
  async voidTransaction(id, reason) {
    const now = Date.now();
    await this.updateTransaction(id, {
      voided: true,
      voidedAt: now,
      voidReason: reason || 'Not specified'
    });
  },

  /**
   * Fetch active and completed transactions (non-voided)
   * @returns {Promise<Array<Object>>}
   */
  async getTransactions() {
    if (mode === 'firestore' && firestoreInstance) {
      try {
        const snap = await firestoreInstance.collection('transactions')
          .orderBy('createdAt', 'desc')
          .get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (e) {
        console.warn('Firestore getTransactions failed, falling back to local:', e);
      }
    }

    const list = getLocal(KEY_TX, []);
    return list.sort((a, b) => {
      const ta = parseDate(a.createdAt)?.getTime() || 0;
      const tb = parseDate(b.createdAt)?.getTime() || 0;
      return tb - ta;
    });
  },

  /**
   * Fetch voided transactions
   * @returns {Promise<Array<Object>>}
   */
  async getVoidedTransactions() {
    const all = await this.getTransactions();
    return all.filter(t => Boolean(t.voided));
  },

  /**
   * Fetch all transactions (including voided) for audit & CSV export
   * @returns {Promise<Array<Object>>}
   */
  async getAllTransactions() {
    return await this.getTransactions();
  },

  /**
   * Filter transactions by date range
   * @param {Date} from
   * @param {Date} to
   * @returns {Promise<Array<Object>>}
   */
  async getTransactionsForPeriod(from, to) {
    const all = await this.getTransactions();
    const fromTime = from ? new Date(from).getTime() : 0;
    const toTime = to ? new Date(to).getTime() : Infinity;

    return all.filter(t => {
      const tTime = parseDate(t.createdAt)?.getTime() || 0;
      return tTime >= fromTime && tTime <= toTime;
    });
  },

  /**
   * Upsert customer record for autocomplete suggestions
   * @param {string} name
   * @param {string} phone
   */
  async upsertCustomer(name, phone) {
    const cleanName = (name || '').trim();
    if (!cleanName) return;

    const customers = getLocal(KEY_CUSTOMERS, []);
    const idx = customers.findIndex(c => c.name.toLowerCase() === cleanName.toLowerCase());

    if (idx !== -1) {
      customers[idx].visitCount = (customers[idx].visitCount || 1) + 1;
      customers[idx].lastVisit = Date.now();
      if (phone) customers[idx].phone = phone.trim();
    } else {
      customers.push({
        name: cleanName,
        phone: (phone || '').trim(),
        visitCount: 1,
        lastVisit: Date.now()
      });
    }

    setLocal(KEY_CUSTOMERS, customers);

    if (mode === 'firestore' && firestoreInstance) {
      try {
        const custRef = firestoreInstance.collection('customers').doc(cleanName.toLowerCase());
        await custRef.set({
          name: cleanName,
          phone: (phone || '').trim(),
          lastVisit: Date.now()
        }, { merge: true });
      } catch (e) {
        // silent fail for customer suggest sync
      }
    }
  },

  /**
   * Search customer directory for typeahead auto-fill
   * @param {string} query
   * @returns {Promise<Array<Object>>}
   */
  async searchCustomers(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];

    const customers = getLocal(KEY_CUSTOMERS, []);
    return customers
      .filter(c => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)))
      .slice(0, 5);
  },

  /**
   * Check for legacy data from window.storage and import if new database is empty
   * @returns {Promise<{ found: boolean, count: number, importFn: Function }>}
   */
  async checkLegacyMigration() {
    let rawData = null;
    try {
      if (window.storage && typeof window.storage.get === 'function') {
        const res = await window.storage.get('shop-data', false);
        if (res && res.value) {
          rawData = JSON.parse(res.value);
        }
      }
    } catch (e) {
      // not available
    }

    if (!rawData) {
      // Check if localStorage has old format
      const oldLocal = localStorage.getItem('shop-data');
      if (oldLocal) {
        try {
          rawData = JSON.parse(oldLocal);
        } catch (e) {}
      }
    }

    if (rawData && Array.isArray(rawData.transactions) && rawData.transactions.length > 0) {
      return {
        found: true,
        count: rawData.transactions.length,
        importFn: async () => {
          let imported = 0;
          for (const oldTx of rawData.transactions) {
            await this.addTransaction({
              name: oldTx.name,
              phone: oldTx.phone || '',
              weight: oldTx.weight,
              type: oldTx.type,
              price: oldTx.price,
              paid: Boolean(oldTx.paid),
              paidAt: oldTx.paidAt || null,
              status: oldTx.status || 'Received',
              createdAt: oldTx.createdAt || Date.now()
            });
            imported++;
          }
          return imported;
        }
      };
    }

    return { found: false, count: 0, importFn: async () => 0 };
  }
};
