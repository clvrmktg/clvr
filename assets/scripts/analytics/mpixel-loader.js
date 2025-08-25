// assets/scripts/analytics/mpixel-loader.js
// Purpose: After idle, inject <script src="/.netlify/functions/meta-pixel?v=...">
// The ?v=... comes from this tag's data-v (deploy hash) or SRI, to bust caches.

(function () {
  if (window.__mpLazyQueued) return;

  function loadMetaPixel() {
    if (window.__mpLazyLoaded) return;

    // Prefer data-v from your Hugo partial; fall back to SRI integrity hash
    var el = document.currentScript || null;
    var version =
      (el && el.getAttribute && el.getAttribute("data-v")) ||
      (el && el.getAttribute && (el.getAttribute("integrity") || "").replace(/^sha\d+-/, "")) ||
      "";

    // Don't inject twice if already present
    var existing = document.querySelector('script[src^="/.netlify/functions/meta-pixel"]');
    if (!existing) {
      var s = document.createElement("script");
      s.async = true;
      s.src = "/.netlify/functions/meta-pixel" + (version ? ("?v=" + encodeURIComponent(version)) : "");
      document.head.appendChild(s);
    }

    window.__mpLazyLoaded = true;
  }

  if ("requestIdleCallback" in window) {
    requestIdleCallback(loadMetaPixel, { timeout: 5000 });
  } else {
    setTimeout(loadMetaPixel, 3000);
  }

  window.__mpLazyQueued = true;
})();
