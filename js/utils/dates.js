/**
 * Normalizes Firestore Timestamp, Date object, or numeric millis to standard Date
 * @param {*} val
 * @returns {Date|null}
 */
export function parseDate(val) {
  if (!val) return null;
  if (typeof val?.toDate === 'function') return val.toDate();
  if (typeof val === 'number') return new Date(val);
  if (val instanceof Date) return val;
  if (val?.seconds) return new Date(val.seconds * 1000);
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Format date for display in PH locale: e.g. "Nov 18, 2026"
 * @param {*} val
 * @returns {string}
 */
export function formatDate(val) {
  const d = parseDate(val);
  if (!d) return '—';
  return d.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Format datetime for display: e.g. "Nov 18, 2026 · 10:05 AM"
 * @param {*} val
 * @returns {string}
 */
export function formatDateTime(val) {
  const d = parseDate(val);
  if (!d) return '';
  const dateStr = d.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const timeStr = d.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit'
  });
  return `${dateStr} · ${timeStr}`;
}

/**
 * Format ISO date for CSV/export (YYYY-MM-DD)
 * @param {*} val
 * @returns {string}
 */
export function formatISO(val) {
  const d = parseDate(val);
  if (!d) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format time for CSV/export (HH:MM:SS)
 * @param {*} val
 * @returns {string}
 */
export function formatTime(val) {
  const d = parseDate(val);
  if (!d) return '';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Returns start and end Date for today
 */
export function getToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Returns start and end Date for current week (Monday to Sunday)
 */
export function getThisWeek() {
  const now = new Date();
  const day = now.getDay();
  // day 0 is Sunday, 1 is Monday
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Returns start and end Date for current month
 */
export function getThisMonth() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}
