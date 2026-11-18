import { formatISO, formatTime } from './dates.js';

/**
 * Escapes CSV field value according to RFC 4180
 * @param {*} val
 * @returns {string}
 */
function escapeCSVField(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports transaction array to a BIR-auditable CSV file and triggers browser download
 * @param {Array<Object>} transactions
 * @param {string} [filename]
 */
export function exportToCSV(transactions = [], filename) {
  const headers = [
    'Code',
    'Date',
    'Time',
    'Customer Name',
    'Phone',
    'Service Type',
    'Weight (kg)',
    'Price (PHP)',
    'Payment Status',
    'Date Paid',
    'Order Status',
    'Voided',
    'Void Reason',
    'Void Date',
    'Notes'
  ];

  const rows = transactions.map(t => {
    const isVoided = Boolean(t.voided);
    const isPaid = Boolean(t.paid);

    return [
      t.code || '',
      formatISO(t.createdAt),
      formatTime(t.createdAt),
      t.name || '',
      t.phone || '',
      t.type === 'express' ? 'Express' : 'Regular',
      t.weight !== undefined ? t.weight : '',
      t.price !== undefined ? Math.round(Number(t.price)) : 0,
      isPaid ? 'PAID' : 'UNPAID',
      isPaid ? (formatISO(t.paidAt) + ' ' + formatTime(t.paidAt)).trim() : '',
      t.status || '',
      isVoided ? 'YES' : 'NO',
      isVoided ? (t.voidReason || '') : '',
      isVoided ? (formatISO(t.voidedAt) + ' ' + formatTime(t.voidedAt)).trim() : '',
      t.notes || ''
    ];
  });

  const csvContent = [
    headers.map(escapeCSVField).join(','),
    ...rows.map(row => row.map(escapeCSVField).join(','))
  ].join('\r\n');

  // Prefix with UTF-8 BOM so Excel opens with proper character encoding
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  const defaultFilename = `ayah-laundry-records-${formatISO(new Date())}.csv`;
  a.href = url;
  a.download = filename || defaultFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
