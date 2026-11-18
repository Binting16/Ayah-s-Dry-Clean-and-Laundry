import { computePrice } from '../utils/currency.js';
import { validateDropOff } from '../utils/validation.js';
import { showToast } from './toast.js';
import { printReceipt } from './receipt.js';
import { escapeHtml } from '../utils/sanitize.js';

let appState = null;
let appDb = null;
let autocompleteDebounceTimer = null;

export function initForm(state, db) {
  appState = state;
  appDb = db;

  const form = document.getElementById('addForm');
  if (!form) return;

  const minWeight = state.settings.minWeight || 5;

  form.innerHTML = `
    <div class="form-group" style="position:relative;">
      <label for="fName">Customer Name *</label>
      <input required id="fName" type="text" placeholder="e.g. Juan Dela Cruz" autocomplete="off">
      <ul class="autocomplete-list" id="nameSuggestions" style="display:none;"></ul>
    </div>

    <div class="form-group">
      <label for="fPhone">Cellphone (Optional)</label>
      <input id="fPhone" type="tel" placeholder="09xx xxx xxxx">
    </div>

    <div class="form-group">
      <label for="fWeight">Weight (kg) *</label>
      <input required id="fWeight" type="number" min="${minWeight}" step="0.5" placeholder="${minWeight}">
    </div>

    <div class="form-group">
      <label for="fType">Service Type *</label>
      <select id="fType">
        <option value="regular">Regular</option>
        <option value="express">Express</option>
      </select>
    </div>

    <div class="form-group">
      <label for="fPrice">Price (₱) *</label>
      <input required id="fPrice" type="number" min="0" step="1" placeholder="0">
    </div>

    <div class="form-group">
      <label for="fPaid">Payment Status *</label>
      <select id="fPaid">
        <option value="unpaid">Unpaid</option>
        <option value="paid">Paid (Timestamped)</option>
      </select>
    </div>

    <div class="btn-submit-wrap">
      <button type="submit" class="btn-primary" id="btnSubmitTx">
        <span>+ Add Transaction</span>
      </button>
    </div>
  `;

  const nameInput = document.getElementById('fName');
  const phoneInput = document.getElementById('fPhone');
  const weightInput = document.getElementById('fWeight');
  const typeSelect = document.getElementById('fType');
  const priceInput = document.getElementById('fPrice');
  const suggestionsList = document.getElementById('nameSuggestions');
  const hintEl = document.getElementById('formHint');

  function updatePrice() {
    const w = parseFloat(weightInput.value) || 0;
    const t = typeSelect.value;
    if (w > 0) {
      const calculated = computePrice(w, t, {
        regular: appState.settings.rateRegular,
        express: appState.settings.rateExpress
      });
      priceInput.value = calculated;
    }
  }

  weightInput.addEventListener('input', updatePrice);
  typeSelect.addEventListener('change', updatePrice);

  // Autocomplete typeahead for returning customers
  nameInput.addEventListener('input', () => {
    const q = nameInput.value.trim();
    if (autocompleteDebounceTimer) clearTimeout(autocompleteDebounceTimer);

    if (q.length < 2) {
      suggestionsList.style.display = 'none';
      suggestionsList.innerHTML = '';
      return;
    }

    autocompleteDebounceTimer = setTimeout(async () => {
      const matches = await appDb.searchCustomers(q);
      if (matches.length > 0) {
        suggestionsList.innerHTML = matches.map(c => `
          <li class="autocomplete-item" data-name="${escapeHtml(c.name)}" data-phone="${escapeHtml(c.phone || '')}">
            <span class="cust-name">${escapeHtml(c.name)}</span>
            ${c.phone ? `<span class="cust-phone">${escapeHtml(c.phone)}</span>` : ''}
          </li>
        `).join('');
        suggestionsList.style.display = 'block';

        suggestionsList.querySelectorAll('.autocomplete-item').forEach(item => {
          item.addEventListener('click', () => {
            nameInput.value = item.dataset.name;
            if (item.dataset.phone) phoneInput.value = item.dataset.phone;
            suggestionsList.style.display = 'none';
            weightInput.focus();
          });
        });
      } else {
        suggestionsList.style.display = 'none';
        suggestionsList.innerHTML = '';
      }
    }, 250);
  });

  // Hide suggestions if user clicks away
  document.addEventListener('click', (e) => {
    if (!nameInput.contains(e.target) && !suggestionsList.contains(e.target)) {
      suggestionsList.style.display = 'none';
    }
  });

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (hintEl) hintEl.textContent = '';

    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const weight = parseFloat(weightInput.value);
    const type = typeSelect.value;
    const price = parseFloat(priceInput.value);
    const isPaid = document.getElementById('fPaid').value === 'paid';
    const currentMinWeight = appState.settings.minWeight || 5;

    const validation = validateDropOff({ name, phone, weight, price }, currentMinWeight);
    if (!validation.isValid) {
      if (hintEl) hintEl.textContent = validation.error;
      showToast(validation.error, 'error');
      return;
    }

    try {
      const newTx = await appDb.addTransaction({
        name,
        phone,
        weight,
        type,
        price,
        paid: isPaid,
        status: 'Received'
      });

      // Reset form
      form.reset();
      priceInput.value = '';
      weightInput.min = appState.settings.minWeight || 5;
      weightInput.placeholder = appState.settings.minWeight || 5;
      suggestionsList.style.display = 'none';

      // Refresh transactions in state
      const all = await appDb.getTransactions();
      appState.allActive = all.filter(t => !t.voided && t.status !== 'Released');
      appState.allReleased = all.filter(t => !t.voided && t.status === 'Released');
      appState.allVoided = await appDb.getVoidedTransactions();
      appState.notify();

      // Show toast with print action
      showToast(`Order ${newTx.code} added successfully!`, 'success', 6000, [
        {
          label: '🖨️ Print Receipt',
          onClick: () => printReceipt(newTx, appState.settings)
        }
      ]);
    } catch (err) {
      console.error('Failed to add transaction:', err);
      showToast('Could not save transaction. Please try again.', 'error');
    }
  });
}
