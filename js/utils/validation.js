/**
 * Validate drop-off form values
 * @param {Object} data
 * @param {number} minWeight
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateDropOff({ name, phone, weight, price }, minWeight = 5) {
  const trimmedName = (name || '').trim();
  if (!trimmedName || trimmedName.length < 2) {
    return { isValid: false, error: 'Please enter a valid customer name (at least 2 characters).' };
  }

  const cleanPhone = (phone || '').replace(/[\s-]/g, '');
  if (cleanPhone) {
    // PH cellphone format: 09XXXXXXXXX or +639XXXXXXXXX
    const isValidPh = /^(09|\+639)\d{9}$/.test(cleanPhone);
    if (!isValidPh && cleanPhone.length < 7) {
      return { isValid: false, error: 'Please enter a valid cellphone number (e.g., 0917 123 4567).' };
    }
  }

  const numWeight = parseFloat(weight);
  if (isNaN(numWeight) || numWeight <= 0) {
    return { isValid: false, error: 'Please enter a valid weight in kg.' };
  }

  if (numWeight < minWeight) {
    return { isValid: false, error: `Minimum weight accepted is ${minWeight} kg.` };
  }

  const numPrice = parseFloat(price);
  if (isNaN(numPrice) || numPrice < 0) {
    return { isValid: false, error: 'Please enter a valid price.' };
  }

  return { isValid: true };
}
