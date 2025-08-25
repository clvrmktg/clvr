// assets/scripts/meta-pixel-init.js
(() => {
  const tag = document.currentScript;
  if (!tag) return;

  const pixelId = tag.dataset.pixelId;
  const version = tag.dataset.version || "";       // cachebuster (git hash / timestamp)
  const locale = tag.dataset.locale || "en_US";

  if (!pixelId) return;

  // Define fbq immediately (queue until script loads)
  function bootstrapFBQ() {
    if (window.fbq) return;
    const n = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    window.fbq = n;
    window._fbq = n;
  }

  function loadPixel() {
    bootstrapFBQ();

    // Load the proxied fbevents.js
    const s = document.createElement("script");
    s.async = true;
    s.src = `/.netlify/functions/meta-pixel?l=${encodeURIComponent(locale)}&v=${encodeURIComponent(version)}`;

    const first = document.getElementsByTagName("script")[0];
    first.parentNode.insertBefore(s, first);

    // Queue calls; they will flush when the script finishes loading
    fbq("init", pixelId);
    fbq("track", "PageView");
  }

  if ("requestIdleCallback" in window) {
    requestIdleCallback(loadPixel, { timeout: 5000 });
  } else {
    setTimeout(loadPixel, 3000);
  }
})();
