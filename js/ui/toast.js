/**
 * Lightweight, non-blocking toast notification manager
 */
let container = null;

function getContainer() {
  if (!container) {
    container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
  }
  return container;
}

/**
 * Display a toast notification
 * @param {string} message
 * @param {'success'|'error'|'info'} [type='info']
 * @param {number} [durationMs]
 * @param {Array<{ label: string, onClick: Function }>} [actions]
 */
export function showToast(message, type = 'info', durationMs, actions = []) {
  const c = getContainer();

  // Limit to 3 toasts at once
  while (c.children.length >= 3) {
    c.removeChild(c.firstChild);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const textSpan = document.createElement('span');
  textSpan.textContent = message;
  toast.appendChild(textSpan);

  if (actions && actions.length > 0) {
    const actionWrap = document.createElement('div');
    actionWrap.className = 'toast-actions';
    for (const act of actions) {
      const btn = document.createElement('button');
      btn.className = 'toast-action-btn';
      btn.textContent = act.label;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        try {
          act.onClick();
        } catch (err) {
          console.error(err);
        }
        removeToast();
      });
      actionWrap.appendChild(btn);
    }
    toast.appendChild(actionWrap);
  }

  c.appendChild(toast);

  let timer = null;
  const timeout = durationMs || (type === 'error' ? 5000 : actions.length > 0 ? 8000 : 3000);

  function removeToast() {
    if (timer) clearTimeout(timer);
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    setTimeout(() => {
      if (toast.parentNode === c) {
        c.removeChild(toast);
      }
    }, 200);
  }

  timer = setTimeout(removeToast, timeout);
}
