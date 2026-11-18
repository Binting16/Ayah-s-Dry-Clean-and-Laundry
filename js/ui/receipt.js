import { formatDateTime, parseDate } from '../utils/dates.js';
import { formatPHP } from '../utils/currency.js';
import { escapeHtml } from '../utils/sanitize.js';

/**
 * Builds the HTML structure for the receipt
 * @param {Object} tx
 * @param {Object} settings
 * @returns {string}
 */
export function buildReceiptHtml(tx, settings = {}) {
  const bizName = settings.businessName || "Ayah's Dry Clean and Laundry";
  const bizAddress = settings.businessAddress || 'Your Address Here';
  const bizTIN = settings.businessTIN || '000-000-000-000';
  const bizPhone = settings.businessPhone || '0900 000 0000';

  const rate = tx.type === 'express'
    ? (settings.rateExpress || 35)
    : (settings.rateRegular || 20);

  const isPaid = Boolean(tx.paid);
  const paidText = isPaid ? 'PAID' : 'UNPAID';
  const dateStr = formatDateTime(tx.createdAt);
  const paidDateStr = isPaid && tx.paidAt ? formatDateTime(tx.paidAt) : null;

  return `
    <div class="receipt-card">
      <div class="receipt-header">
        <img src="assets/logo-placeholder.svg" alt="Logo" class="receipt-logo">
        <h2>${escapeHtml(bizName)}</h2>
        <p>${escapeHtml(bizAddress)}</p>
        <p>TIN: ${escapeHtml(bizTIN)}</p>
        <p>Tel: ${escapeHtml(bizPhone)}</p>
      </div>

      <div class="receipt-title">ORDER RECEIPT</div>

      <div class="receipt-details">
        <div class="receipt-row bold">
          <span>Order Code:</span>
          <span>${escapeHtml(tx.code)}</span>
        </div>
        <div class="receipt-row">
          <span>Date / Time:</span>
          <span>${dateStr}</span>
        </div>
        <div class="receipt-row">
          <span>Customer:</span>
          <span>${escapeHtml(tx.name)}</span>
        </div>
        ${tx.phone ? `
        <div class="receipt-row">
          <span>Cellphone:</span>
          <span>${escapeHtml(tx.phone)}</span>
        </div>` : ''}

        <hr class="receipt-divider">

        <div class="receipt-row">
          <span>Service:</span>
          <span>${tx.type === 'express' ? 'Express Laundry' : 'Regular Laundry'}</span>
        </div>
        <div class="receipt-row">
          <span>Weight:</span>
          <span>${tx.weight} kg</span>
        </div>
        <div class="receipt-row">
          <span>Rate:</span>
          <span>₱${rate}/kg</span>
        </div>

        <hr class="receipt-divider">

        <div class="receipt-total-row">
          <span>TOTAL:</span>
          <span>${formatPHP(tx.price)}</span>
        </div>

        <div class="receipt-row bold" style="margin-top:6px; color:${isPaid ? '#15803D' : '#B91C1C'};">
          <span>Payment:</span>
          <span>${paidText}</span>
        </div>
        ${paidDateStr ? `
        <div class="receipt-row" style="font-size:0.75rem; color:#555;">
          <span>Paid on:</span>
          <span>${paidDateStr}</span>
        </div>` : ''}

        <div class="receipt-row" style="margin-top:6px;">
          <span>Current Status:</span>
          <span>${escapeHtml(tx.status || 'Received')}</span>
        </div>
      </div>

      <div class="receipt-footer">
        <p><strong>* Please present this receipt when claiming laundry.</strong></p>
        <p>Thank you for choosing Ayah's Dry Clean & Laundry!</p>
      </div>
    </div>
  `;
}

/**
 * Triggers the browser print dialog for the given transaction
 * @param {Object} tx
 * @param {Object} [settings]
 */
export function printReceipt(tx, settings = {}) {
  let printArea = document.getElementById('receiptPrintArea');
  if (!printArea) {
    printArea = document.createElement('div');
    printArea.id = 'receiptPrintArea';
    printArea.className = 'receipt-print-area';
    document.body.appendChild(printArea);
  }

  printArea.innerHTML = buildReceiptHtml(tx, settings);

  // Set print mode class on body for media query sizing
  const pMode = settings.printMode || 'a4';
  document.body.classList.remove('print-mode-a4', 'print-mode-thermal-80', 'print-mode-thermal-58');
  document.body.classList.add(`print-mode-${pMode}`);

  // Small delay to ensure styles and assets render
  setTimeout(() => {
    window.print();
  }, 100);
}
