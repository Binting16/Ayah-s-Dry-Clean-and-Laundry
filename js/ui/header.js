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
        <span>💾 <strong>Local Storage Mode:</strong> Records are saved in this browser. To enable live Google Sheets sync and annual cloud backups, paste your Apps Script URL in <a href="#" id="bannerOpenSettings">Settings (⚙️)</a>.</span>
      </div>
      <button class="db-banner-close" title="Dismiss banner">&times;</button>
    `;

    banner.querySelector('#bannerOpenSettings')?.addEventListener('click', (e) => {
      e.preventDefault();
      openSettings(state);
    });

    banner.querySelector('.db-banner-close')?.addEventListener('click', () => {
      banner.style.display = 'none';
    });
  } else {
    banner.style.display = 'none';
  }
}
