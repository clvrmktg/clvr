// assets/scripts/analytics/mpixel-loader.js  (or /static/scripts/...)
(function () {
  if (window.__mpLazyQueued) return;

  function loadMetaPixel() {
    if (window.__mpLazyLoaded) return;

    // Version to forward to the Netlify Function (for cache-busting)
    var el = document.currentScript || null;
    var v = "";
    try {
      v =
        (el && el.getAttribute && el.getAttribute("data-v")) ||
        (el && el.getAttribute && (el.getAttribute("integrity") || "").replace(/^sha\d+-/, "")) ||
        "";
    } catch (e) {}

    // Don't add if it's already on the page
    var existing = document.querySelector('script[src^="/.netlify/functions/meta-pixel"]');
    if (!existing) {
      var s = document.createElement("script");
      s.async = true;
      s.src = "/.netlify/functions/meta-pixel" + (v ? "?v=" + encodeURIComponent(v) : "");
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
