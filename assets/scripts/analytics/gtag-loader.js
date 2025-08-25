// assets/scripts/analytics/gtag-loader.js
(function () {
  if (window.__gaLazyQueued) return;

  function loadGA() {
    if (window.__gaLazyLoaded) return;

    // Forward a version (from data-v or integrity) to bust the function cache
    var el = document.currentScript || null;
    var v = "";
    try {
      v = (el && el.getAttribute && el.getAttribute("data-v")) ||
          (el && el.getAttribute && (el.getAttribute("integrity") || "").replace(/^sha\\d+-/, "")) ||
          "";
    } catch (e) {}

    // Inject the Netlify Function script
    var s = document.createElement("script");
    s.async = true;
    s.src = "/.netlify/functions/gtag" + (v ? "?v=" + encodeURIComponent(v) : "");
    document.head.appendChild(s);

    window.__gaLazyLoaded = true;
  }

  if ("requestIdleCallback" in window) {
    requestIdleCallback(loadGA, { timeout: 5000 });
  } else {
    setTimeout(loadGA, 3000);
  }

  window.__gaLazyQueued = true;
})();
