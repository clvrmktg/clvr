const banner = document.getElementById('cookie-banner');
const consentKey = 'analytics_consent';
let savedConsent = null;
try { savedConsent = localStorage.getItem(consentKey); } catch { /* Default to no tracking. */ }
window.cleverAnalyticsConsent = savedConsent === 'true';

if (banner && savedConsent !== 'true' && savedConsent !== 'false') {
  banner.style.display = 'grid';
}

function setConsent(accepted) {
  const wasAccepted = window.cleverAnalyticsConsent;
  window.cleverAnalyticsConsent = accepted;
  try { localStorage.setItem(consentKey, String(accepted)); } catch { /* Keep the choice for this page. */ }
  if (banner) banner.style.display = 'none';
  window.dispatchEvent(new CustomEvent('analytics-consent'));
  // Reload after withdrawal to stop vendor code already executing on this page.
  if (wasAccepted && !accepted) window.location.reload();
}

document.getElementById('accept-cookies')?.addEventListener('click', () => setConsent(true));

// Apply choices made in another open tab as well.
window.addEventListener('storage', event => {
  if (event.key !== consentKey && event.key !== null) return;
  const accepted = event.key === consentKey && event.newValue === 'true';
  const wasAccepted = window.cleverAnalyticsConsent;
  window.cleverAnalyticsConsent = accepted;
  window.dispatchEvent(new CustomEvent('analytics-consent'));
  if (wasAccepted && !accepted) window.location.reload();
});
