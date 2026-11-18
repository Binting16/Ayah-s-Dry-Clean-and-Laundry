import { openSettings } from './settings.js';

export function initHeader(state) {
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      openSettings(state);
    });
  }

  updateDbBanner(state);
}

export function updateDbBanner(state) {
  const banner = document.getElementById('dbBanner');
  if (!banner) return;

  if (state.dbMode === 'localStorage') {
    banner.style.display = 'flex';
    banner.innerHTML = `
      <div class="db-banner-content">
        <span>💾 <strong>Local Storage Mode:</strong> Records are saved in this browser. To sync across devices and cloud backup for BIR, configure Firebase in <code>js/config.js</code>.</span>
      </div>
      <button class="db-banner-close" title="Dismiss banner">&times;</button>
    `;

    const closeBtn = banner.querySelector('.db-banner-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        banner.style.display = 'none';
      });
    }
  } else {
    banner.style.display = 'none';
  }
}
