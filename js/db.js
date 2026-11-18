import { GOOGLE_SHEETS_WEBAPP_URL, DEFAULT_SETTINGS, STORAGE_PREFIX } from './config.js';
import { generateYearCode } from './utils/codes.js';
import { formatISO, formatTime, parseDate } from './utils/dates.js';

let mode = 'localStorage';
let webAppUrl = '';

// LocalStorage Helper Keys
const KEY_TX = `${STORAGE_PREFIX}:transactions`;
const KEY_SETTINGS = `${STORAGE_PREFIX}:settings`;
const KEY_CUSTOMERS = `${STORAGE_PREFIX}:customers`;
const KEY_CASHFLOW = `${STORAGE_PREFIX}:cashflow`;

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

/**
 * Send request to Google Apps Script Web App
 * @param {string} action
 * @param {Object} [payload={}]
 * @returns {Promise<any>}
 */
async function callSheetsApi(action, payload = {}) {
  if (!webAppUrl) throw new Error('No Google Sheets Web App URL configured');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8' // Text/plain avoids CORS preflight OPTIONS rejection
      },
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Server error');
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export const db = {
  /**
   * Initializes database connection.
   * Tests Google Sheets Web App if URL is present; falls back to localStorage otherwise.
   * @returns {Promise<'google-sheets'|'localStorage'>}
   */
  async init() {
    const localSettings = getLocal(KEY_SETTINGS, DEFAULT_SETTINGS);
    const candidateUrl = (localSettings.googleSheetsUrl || GOOGLE_SHEETS_WEBAPP_URL || '').trim();

    if (candidateUrl && candidateUrl !== 'REPLACE_ME_WITH_APPS_SCRIPT_WEBAPP_URL' && candidateUrl.startsWith('https://')) {
      webAppUrl = candidateUrl;
      try {
        const ping = await callSheetsApi('ping');
        if (ping && ping.success) {
          mode = 'google-sheets';
          return 'google-sheets';
        }
      } catch (err) {
        console.warn('Google Sheets Web App unavailable, operating in offline localStorage mode:', err);
      }
    }

    mode = 'localStorage';
    return 'localStorage';
  },

  getMode() {
    return mode;
  },

  getWebAppUrl() {
    return webAppUrl;
  },

  setWebAppUrl(url) {
    webAppUrl = (url || '').trim();
  },

  /**
   * Fetch current shop settings
   * @returns {Promise<Object>}
   */
  async getSettings() {
    if (mode === 'google-sheets') {
      try {
        const res = await callSheetsApi('getSettings');
        if (res && res.settings) {
          setLocal(KEY_SETTINGS, { ...DEFAULT_SETTINGS, ...res.settings });
          return { ...DEFAULT_SETTINGS, ...res.settings };
        }
      } catch (e) {
        console.warn('Sheets getSettings failed, using local cache:', e);
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
    const current = await this.getSettings();
    const merged = { ...current, ...updates };
    setLocal(KEY_SETTINGS, merged);

    if (updates.googleSheetsUrl !== undefined) {
      webAppUrl = (updates.googleSheetsUrl || '').trim();
    }

    if (mode === 'google-sheets' || (webAppUrl && webAppUrl !== 'REPLACE_ME_WITH_APPS_SCRIPT_WEBAPP_URL')) {
      try {
        await callSheetsApi('updateSettings', { settings: updates });
        mode = 'google-sheets';
      } catch (e) {
        console.warn('Failed to sync settings to Google Sheets:', e);
      }
    }

    return merged;
  },

  /**
   * Add a new drop-off transaction with automatic date and time
   * @param {Object} tx
   * @returns {Promise<Object>}
   */
  async addTransaction(tx) {
    const settings = await this.getSettings();
    const now = new Date();
    const currentYear = now.getFullYear();

    // Auto-reset counter on new year
    let nextCounter = Number(settings.counter) || 0;
    if (Number(settings.counterYear) !== currentYear) {
      nextCounter = 0;
    }
    nextCounter += 1;

    const code = tx.code || generateYearCode(currentYear, nextCounter);

    const timestamp = now.getTime();
    const dateStr = formatISO(now);
    const timeStr = formatTime(now);

    const isPaid = Boolean(tx.paid);

    const newRecord = {
      code,
      createdAt: timestamp,
      date: dateStr,
      time: timeStr,
      name: (tx.name || '').trim(),
      phone: (tx.phone || '').trim(),
      weight: parseFloat(tx.weight) || 0,
      type: tx.type === 'express' ? 'express' : 'regular',
      price: Math.round(Number(tx.price)) || 0,
      paid: isPaid,
      paidAt: isPaid ? (tx.paidAt || timestamp) : null,
      status: tx.status || 'Received',
      recordStatus: 'ACTIVE',
      deleteReason: '',
      deletedAt: null,
      notes: tx.notes || ''
    };

    // Save locally
    const list = getLocal(KEY_TX, []);
    list.unshift(newRecord);
    setLocal(KEY_TX, list);

    // Update settings counter and active year
    await this.updateSettings({ counter: nextCounter, counterYear: currentYear });

    // Upsert customer info
    await this.upsertCustomer(newRecord.name, newRecord.phone);

    // Sync to Google Sheets
    if (mode === 'google-sheets') {
      try {
        const res = await callSheetsApi('addTransaction', { transaction: newRecord });
        if (res && res.transaction) {
          return res.transaction;
        }
      } catch (e) {
        console.warn('Failed to add transaction to Google Sheets, saved in local buffer:', e);
      }
    }

    return newRecord;
  },

  /**
   * Fetch transactions
   * @param {number} [year]
   * @param {boolean} [includeDeleted=false]
   * @returns {Promise<Array<Object>>}
   */
  async getTransactions(year = new Date().getFullYear(), includeDeleted = false) {
    if (mode === 'google-sheets') {
      try {
        const res = await callSheetsApi('getTransactions', { year, includeDeleted });
        if (res && Array.isArray(res.transactions)) {
          setLocal(KEY_TX, res.transactions);
          return res.transactions;
        }
      } catch (e) {
        console.warn('Sheets getTransactions failed, using local fallback:', e);
      }
    }

    const localList = getLocal(KEY_TX, []);
    return localList
      .filter(t => {
        if (!includeDeleted && String(t.recordStatus).toUpperCase() === 'DELETED') {
          return false;
        }
        if (year) {
          const d = parseDate(t.createdAt);
          if (d && d.getFullYear() !== Number(year)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const ta = parseDate(a.createdAt)?.getTime() || 0;
        const tb = parseDate(b.createdAt)?.getTime() || 0;
        return tb - ta;
      });
  },

  /**
   * Update an existing transaction
   * @param {string} code
   * @param {Object} updates
   */
  async updateTransaction(code, updates) {
    const list = getLocal(KEY_TX, []);
    const idx = list.findIndex(t => t.code === code);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates, updatedAt: Date.now() };
      setLocal(KEY_TX, list);
    }

    if (mode === 'google-sheets') {
      try {
        await callSheetsApi('updateTransaction', { code, updates });
      } catch (e) {
        console.warn('Sheets updateTransaction failed:', e);
      }
    }
  },

  /**
   * Soft-delete transaction (Removed from counter, preserved in BIR)
   * @param {string} code
   * @param {string} reason
   */
  async deleteTransaction(code, reason) {
    const list = getLocal(KEY_TX, []);
    const idx = list.findIndex(t => t.code === code);
    if (idx !== -1) {
      list[idx].recordStatus = 'DELETED';
      list[idx].deleteReason = reason || 'Staff deleted';
      list[idx].deletedAt = Date.now();
      setLocal(KEY_TX, list);
    }

    if (mode === 'google-sheets') {
      try {
        await callSheetsApi('deleteTransaction', { code, reason });
      } catch (e) {
        console.warn('Sheets deleteTransaction failed:', e);
      }
    }
  },

  /**
   * Hard-purge transaction completely from database
   * @param {string} code
   * @param {number} [year]
   */
  async purgeTransaction(code, year = new Date().getFullYear()) {
    let list = getLocal(KEY_TX, []);
    list = list.filter(t => t.code !== code);
    setLocal(KEY_TX, list);

    if (mode === 'google-sheets') {
      try {
        await callSheetsApi('purgeTransaction', { code, year });
      } catch (e) {
        console.warn('Sheets purgeTransaction failed:', e);
      }
    }
  },

  /**
   * Clear all test data for a given year and reset counter to 0
   * @param {number} [year]
   */
  async clearTestData(year = new Date().getFullYear()) {
    // Keep only transactions that do not belong to this year
    const list = getLocal(KEY_TX, []);
    const remaining = list.filter(t => {
      const d = parseDate(t.createdAt);
      return d && d.getFullYear() !== Number(year);
    });
    setLocal(KEY_TX, remaining);

    // Reset settings counter
    await this.updateSettings({ counter: 0, counterYear: year });

    if (mode === 'google-sheets') {
      try {
        await callSheetsApi('clearTestData', { year });
      } catch (e) {
        console.warn('Sheets clearTestData failed:', e);
      }
    }
  },

  /**
   * Add a petty cash / delivery cashflow movement (IN / OUT)
   * @param {Object} entry
   */
  async addCashflow(entry) {
    const now = new Date();
    const entryId = 'CF-' + now.getTime().toString(36).toUpperCase();
    const dateStr = formatISO(now);
    const timeStr = formatTime(now);

    const record = {
      entryId,
      createdAt: now.getTime(),
      date: dateStr,
      time: timeStr,
      type: (entry.type || 'OUT').toUpperCase(),
      amount: Number(entry.amount) || 0,
      category: entry.category || 'General',
      notes: entry.notes || ''
    };

    const cashflows = getLocal(KEY_CASHFLOW, []);
    cashflows.unshift(record);
    setLocal(KEY_CASHFLOW, cashflows);

    if (mode === 'google-sheets') {
      try {
        await callSheetsApi('addCashflow', { entry: record });
      } catch (e) {
        console.warn('Sheets addCashflow failed:', e);
      }
    }

    return record;
  },

  /**
   * Fetch cashflow entries
   * @param {number} [limit=100]
   */
  async getCashflow(limit = 100) {
    if (mode === 'google-sheets') {
      try {
        const res = await callSheetsApi('getCashflow', { limit });
        if (res && Array.isArray(res.cashflow)) {
          setLocal(KEY_CASHFLOW, res.cashflow);
          return res.cashflow;
        }
      } catch (e) {
        console.warn('Sheets getCashflow failed, using local cache:', e);
      }
    }

    const list = getLocal(KEY_CASHFLOW, []);
    return list.slice(0, limit);
  },

  /**
   * Fetch daily, monthly, and annual sales recap
   * @param {number} [year]
   * @returns {Promise<Object>}
   */
  async getRecap(year = new Date().getFullYear()) {
    if (mode === 'google-sheets') {
      try {
        const res = await callSheetsApi('getRecap', { year });
        if (res && res.recap) return res.recap;
      } catch (e) {
        console.warn('Sheets getRecap failed, calculating locally:', e);
      }
    }

    // Local calculation fallback
    const all = await this.getTransactions(year, true);
    const annual = { totalOrders: 0, totalWeight: 0, grossSales: 0, collected: 0, unpaid: 0, deleted: 0 };
    const daily = {};
    const monthly = {};

    for (const t of all) {
      const isDeleted = String(t.recordStatus).toUpperCase() === 'DELETED';
      if (isDeleted) {
        annual.deleted++;
        continue;
      }

      const dateStr = t.date || formatISO(t.createdAt);
      const monthStr = dateStr.substring(0, 7);
      const weight = Number(t.weight) || 0;
      const price = Number(t.price) || 0;
      const isPaid = Boolean(t.paid);

      annual.totalOrders++;
      annual.totalWeight += weight;
      annual.grossSales += price;
      if (isPaid) annual.collected += price;
      else annual.unpaid += price;

      if (!daily[dateStr]) daily[dateStr] = { orders: 0, weight: 0, sales: 0, collected: 0, unpaid: 0 };
      daily[dateStr].orders++;
      daily[dateStr].weight += weight;
      daily[dateStr].sales += price;
      if (isPaid) daily[dateStr].collected += price;
      else daily[dateStr].unpaid += price;

      if (!monthly[monthStr]) monthly[monthStr] = { orders: 0, weight: 0, sales: 0, collected: 0, unpaid: 0 };
      monthly[monthStr].orders++;
      monthly[monthStr].weight += weight;
      monthly[monthStr].sales += price;
      if (isPaid) monthly[monthStr].collected += price;
      else monthly[monthStr].unpaid += price;
    }

    return { daily, monthly, annual };
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
   * Migration check for earlier storage
   */
  async checkLegacyMigration() {
    let rawData = null;
    try {
      if (window.storage && typeof window.storage.get === 'function') {
        const res = await window.storage.get('shop-data', false);
        if (res && res.value) rawData = JSON.parse(res.value);
      }
    } catch (e) {}

    if (!rawData) {
      const oldLocal = localStorage.getItem('shop-data');
      if (oldLocal) {
        try { rawData = JSON.parse(oldLocal); } catch (e) {}
      }
    }

    if (rawData && Array.isArray(rawData.transactions) && rawData.transactions.length > 0) {
      return {
        found: true,
        count: rawData.transactions.length,
        importFn: async () => {
          let count = 0;
          for (const old of rawData.transactions) {
            await this.addTransaction({
              name: old.name,
              phone: old.phone || '',
              weight: old.weight,
              type: old.type,
              price: old.price,
              paid: Boolean(old.paid),
              paidAt: old.paidAt || null,
              status: old.status || 'Received'
            });
            count++;
          }
          return count;
        }
      };
    }

    return { found: false, count: 0, importFn: async () => 0 };
  }
};
