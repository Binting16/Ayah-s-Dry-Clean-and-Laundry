import { escapeHtml } from '../utils/sanitize.js';

let overlay = null;

function getOverlay() {
  if (!overlay) {
    overlay = document.getElementById('modalOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'modalOverlay';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }
  }
  return overlay;
}

/**
 * Display confirmation or input modal
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} [options.confirmLabel='Confirm']
 * @param {string} [options.cancelLabel='Cancel']
 * @param {'primary'|'danger'} [options.confirmStyle='primary']
 * @param {boolean} [options.requireReason=false]
 * @param {Array<string>} [options.reasonOptions=[]]
 * @param {Function} options.onConfirm
 * @param {Function} [options.onCancel]
 */
export function showModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmStyle = 'primary',
  requireReason = false,
  reasonOptions = [],
  onConfirm,
  onCancel
}) {
  const o = getOverlay();
  o.innerHTML = '';
  o.style.display = 'flex';

  const card = document.createElement('div');
  card.className = 'modal-card';

  let reasonSelectHtml = '';
  if (requireReason && reasonOptions.length > 0) {
    const opts = reasonOptions.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
    reasonSelectHtml = `
      <div style="margin: 14px 0 20px;">
        <label style="display:block; font-size:0.82rem; font-weight:600; margin-bottom:6px; color:var(--ink);">Reason for voiding:</label>
        <select id="modalReasonSelect" style="width:100%; min-height:44px; padding:8px 12px; border:1px solid var(--border); border-radius:var(--radius-md); font-size:0.95rem; background:#fff;">
          ${opts}
        </select>
      </div>
    `;
  }

  card.innerHTML = `
    <h3 class="modal-title">${escapeHtml(title)}</h3>
    <div class="modal-body">${escapeHtml(message)}</div>
    ${reasonSelectHtml}
    <div class="modal-actions">
      <button class="btn-secondary" id="modalCancelBtn">${escapeHtml(cancelLabel)}</button>
      <button class="btn-${confirmStyle}" id="modalConfirmBtn">${escapeHtml(confirmLabel)}</button>
    </div>
  `;

  o.appendChild(card);

  function closeModal() {
    o.style.display = 'none';
    o.innerHTML = '';
  }

  const cancelBtn = card.querySelector('#modalCancelBtn');
  const confirmBtn = card.querySelector('#modalConfirmBtn');

  cancelBtn.addEventListener('click', () => {
    closeModal();
    if (typeof onCancel === 'function') onCancel();
  });

  confirmBtn.addEventListener('click', () => {
    let reason = null;
    if (requireReason) {
      const sel = card.querySelector('#modalReasonSelect');
      reason = sel ? sel.value : '';
    }
    closeModal();
    if (typeof onConfirm === 'function') onConfirm(reason);
  });

  // Close when clicking overlay backdrop
  o.onclick = (e) => {
    if (e.target === o) {
      closeModal();
      if (typeof onCancel === 'function') onCancel();
    }
  };
}
